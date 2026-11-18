import { z } from 'zod/v3';
import { chatJson, getProvider, type ChatMessage, type Usage } from './provider.js';
import type { Hit } from './retrieval.js';

/**
 * The model-backed agents. Each is one narrow job with its own prompt and, where
 * the output feeds code, a schema the reply must satisfy. None of them reads the
 * database or calls another agent: the pipelines in pipelines.ts do the wiring,
 * which keeps every agent testable with a scripted provider.
 */

type Spend = (usage: Usage) => void;

const ROLE_LABEL: Record<string, string> = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'administrator',
  ORG_ADMIN: 'administrator',
  PROCTOR: 'proctor',
};
export const roleLabel = (role: string) => ROLE_LABEL[role] ?? 'user';

export const formatSources = (hits: Hit[]): string =>
  hits
    .map((hit, i) => {
      const where = [hit.documentTitle, hit.heading].filter(Boolean).join(' — ');
      return `[${i + 1}] ${where}${hit.course ? ` (${hit.course.code})` : ''}\n${hit.content}`;
    })
    .join('\n\n');

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);
// Room for the snapshot plus the people directory (~45 accounts for an admin).
const RECORDS_CHARS = 24_000;

/** The last few turns, clipped: enough to resolve a follow-up, not enough to bloat the prompt. */
const recent = (history: ChatMessage[], turns = 6, max = 500): ChatMessage[] =>
  history.slice(-turns).map((m) => ({ role: m.role, content: clip(m.content, max) }));

/* ------------------------------------------------------------ supervisor */

const planSchema = z.object({
  route: z.enum(['knowledge', 'records', 'both', 'chat']),
  queries: z.array(z.string().min(2).max(200)).max(3).default([]),
  reason: z.string().max(300).default(''),
});
export type Plan = z.infer<typeof planSchema>;

const SUPERVISOR = `You are the Supervisor of a multi-agent study system used by a college. You never answer the user. You decide which specialists handle the latest message, and you write the search queries for the Retriever.

Routes:
- "knowledge": the answer is in course material or institute documents (concepts, definitions, how something works, comparisons, exam rules, grading policy).
- "records": the answer is in platform data: the user's own tests, deadlines, scores and assignments; counts of students, attempts and questions; or details about people on the platform (a named student, teacher or proctor, lists of users, who has the highest score, who is placed).
- "both": it needs course material and the user's data together, for example "what should I revise before my next test".
- "chat": a greeting, thanks, or a question about what this system can do.

For "knowledge" and "both" write 1 to 3 short search queries. Each must stand alone: resolve pronouns and follow-ups from the conversation, and use the terms a textbook would use. For "records" and "chat" return an empty list.

Return JSON: {"route": "knowledge|records|both|chat", "queries": ["..."], "reason": "one short sentence"}`;

export async function supervise(
  input: { question: string; history: ChatMessage[]; role: string; courses: string[] },
  spend: Spend,
  signal?: AbortSignal,
): Promise<Plan> {
  const transcript = recent(input.history, 6, 300)
    .map((m) => `${m.role === 'user' ? 'User' : 'System'}: ${m.content}`)
    .join('\n');
  const { data, usage } = await chatJson(
    [
      { role: 'system', content: SUPERVISOR },
      {
        role: 'user',
        content: [
          `User role: ${roleLabel(input.role)}`,
          `Courses in scope: ${input.courses.join('; ') || 'none'}`,
          transcript ? `Conversation so far:\n${transcript}` : null,
          `Latest message: ${input.question}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    planSchema,
    { temperature: 0, maxTokens: 220, signal },
  );
  spend(usage);
  const needsSearch = data.route === 'knowledge' || data.route === 'both';
  // A plan that asks for retrieval without a query still has the question itself.
  return { ...data, queries: needsSearch ? (data.queries.length ? data.queries : [input.question]) : [] };
}

/* ----------------------------------------------------------------- tutor */

const TUTOR = (role: string) => `You are the Tutor in a multi-agent study system used by a college. You are talking to a ${roleLabel(role)}.

Answer the latest message using only the numbered SOURCES and the RECORDS block.
- Put a citation such as [2] straight after each sentence or list item that a source supports. Cite only numbers that appear in SOURCES. Never invent a source.
- RECORDS are live figures from the platform database. Quote them exactly. They need no citation.
- RECORDS.people lists only the accounts this user may see (RECORDS.people.visibleTo). If they ask about someone not listed, say their role does not give access to that person's information. Never call the data "RECORDS" in your reply; say "platform records".
- If SOURCES and RECORDS do not contain the answer, say so in one sentence and name what is missing. Do not fill the gap from general knowledge.
- Write Markdown: short paragraphs, a list or a table where it makes the answer easier to scan, fenced code for code. No preamble, no closing offer.
- For a student, teach: explain the idea, then walk through the worked example from the source when there is one. For staff, be brief and exact.`;

const FRONT_DESK = (role: string) => `You are the front desk of a multi-agent study system used by a college, talking to a ${roleLabel(role)}. Reply in at most three sentences. If asked what you can do: answer questions from course material and institute documents with citations, report on the user's own tests, deadlines and results${
  role === 'STUDENT' ? ', and debrief a finished test into a revision plan' : ', and draft exam questions that a second agent verifies against the source'
}. Do not answer subject questions here.`;

export interface AnswerInput {
  question: string;
  history: ChatMessage[];
  role: string;
  hits: Hit[];
  records: unknown | null;
  /** Set on the second pass: the claims the Verifier could not find in the sources. */
  unsupported?: string[];
  previous?: string;
}

export async function answer(
  input: AnswerInput,
  spend: Spend,
  opts: { onToken?: (text: string) => void; signal?: AbortSignal } = {},
): Promise<string> {
  const context = [
    `SOURCES\n${input.hits.length ? formatSources(input.hits) : '(none retrieved)'}`,
    `RECORDS\n${input.records ? clip(JSON.stringify(input.records), RECORDS_CHARS) : '(none requested)'}`,
    `Latest message: ${input.question}`,
  ].join('\n\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: TUTOR(input.role) },
    ...recent(input.history),
    { role: 'user', content: context },
  ];
  if (input.unsupported?.length && input.previous) {
    messages.push(
      { role: 'assistant', content: input.previous },
      {
        role: 'user',
        content: `The Verifier could not find these claims in SOURCES or RECORDS:\n${input.unsupported
          .map((claim) => `- ${claim}`)
          .join('\n')}\nRewrite the whole answer so that every claim is supported. Remove what cannot be supported.`,
      },
    );
  }
  const reply = await getProvider().chat(messages, { temperature: 0.2, maxTokens: 1100, ...opts });
  spend(reply.usage);
  return reply.text;
}

export async function smallTalk(
  input: { question: string; history: ChatMessage[]; role: string },
  spend: Spend,
  opts: { onToken?: (text: string) => void; signal?: AbortSignal } = {},
): Promise<string> {
  const reply = await getProvider().chat(
    [
      { role: 'system', content: FRONT_DESK(input.role) },
      ...recent(input.history, 4, 300),
      { role: 'user', content: input.question },
    ],
    { temperature: 0.3, maxTokens: 200, ...opts },
  );
  spend(reply.usage);
  return reply.text;
}

/* -------------------------------------------------------------- verifier */

const verdictSchema = z.object({
  verdict: z.enum(['grounded', 'partial', 'ungrounded']),
  unsupported: z.array(z.string().max(400)).max(6).default([]),
  note: z.string().max(400).default(''),
});
export type Verdict = z.infer<typeof verdictSchema>;

const VERIFIER = `You are the Verifier in a multi-agent study system. You check another agent's answer against the material it was given. You are strict, and you do not rewrite the answer.

A claim is supported only if a SOURCE or the RECORDS block states it, or it follows directly from one. General knowledge does not count, even when it is true.
- "grounded": every factual claim is supported.
- "partial": the main answer is supported, but one or more side claims are not.
- "ungrounded": the main answer is not supported, or it contradicts a source.

Return JSON: {"verdict": "grounded|partial|ungrounded", "unsupported": ["each unsupported claim, quoted briefly"], "note": "one short sentence"}`;

export async function verify(
  input: { answer: string; hits: Hit[]; records: unknown | null },
  spend: Spend,
  signal?: AbortSignal,
): Promise<Verdict> {
  const { data, usage } = await chatJson(
    [
      { role: 'system', content: VERIFIER },
      {
        role: 'user',
        content: [
          `SOURCES\n${formatSources(input.hits)}`,
          `RECORDS\n${input.records ? clip(JSON.stringify(input.records), RECORDS_CHARS) : '(none)'}`,
          `ANSWER TO CHECK\n${input.answer}`,
        ].join('\n\n'),
      },
    ],
    verdictSchema,
    { temperature: 0, maxTokens: 400, signal },
  );
  spend(usage);
  return data;
}

/* -------------------------------------------------- examiner and reviewer */

export const QUESTION_TYPES = ['SINGLE', 'MULTIPLE', 'TRUE_FALSE'] as const;
export type AuthoredType = (typeof QUESTION_TYPES)[number];

const draftSchema = z.object({
  questions: z
    .array(
      z.object({
        text: z.string().min(10).max(800),
        options: z.array(z.string().min(1).max(300)).min(2).max(5),
        correct: z.array(z.number().int().min(0).max(4)).min(1).max(4),
        explanation: z.string().min(5).max(800),
        source: z.number().int().min(1),
        bloom: z.enum(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE']).catch('UNDERSTAND'),
      }),
    )
    .min(1)
    .max(12),
});
export type Draft = z.infer<typeof draftSchema>['questions'][number];

const TYPE_RULE: Record<AuthoredType, string> = {
  SINGLE: 'Each question has exactly 4 options and exactly 1 correct option.',
  MULTIPLE:
    'Each question has exactly 4 options, of which 2 or 3 are correct. End the question text with "Select all that apply."',
  TRUE_FALSE: 'Each question is a single statement. Its options are exactly ["True", "False"], with 1 correct.',
};

const EXAMINER = (type: AuthoredType, difficulty: string) => `You are the Examiner in a multi-agent study system. You write exam questions for a college course, strictly from the numbered SOURCES.

- Every question must be answerable from one source alone. Put that source's number in "source".
- Test only what the sources state. Never mention "the source", "the passage" or "the text" in a question.
- ${TYPE_RULE[type]}
- Wrong options must tempt a student who half-knows the topic and be clearly wrong to one who knows it. Never use "all of the above" or "none of the above".
- "correct" holds the zero-based indices of the correct options.
- "explanation" says why the answer is right, in one or two sentences a teacher would write.
- Difficulty is ${difficulty}. EASY recalls a stated fact, MEDIUM needs understanding, HARD and EXPERT apply the idea to a small case.
- Each question tests a different fact.

Return JSON: {"questions": [{"text": "...", "options": ["..."], "correct": [0], "explanation": "...", "source": 1, "bloom": "REMEMBER|UNDERSTAND|APPLY|ANALYZE|EVALUATE"}]}`;

export async function draftQuestions(
  input: { topic: string; count: number; type: AuthoredType; difficulty: string; hits: Hit[] },
  spend: Spend,
  signal?: AbortSignal,
): Promise<Draft[]> {
  const { data, usage } = await chatJson(
    [
      { role: 'system', content: EXAMINER(input.type, input.difficulty) },
      {
        role: 'user',
        content: `Topic: ${input.topic}\nWrite ${input.count} questions.\n\nSOURCES\n${formatSources(input.hits)}`,
      },
    ],
    draftSchema,
    { temperature: 0.5, maxTokens: 350 * input.count + 300, signal },
  );
  spend(usage);
  return data.questions.slice(0, input.count);
}

const reviewSchema = z.object({
  answers: z.array(
    z.object({
      index: z.number().int().min(1),
      correct: z.array(z.number().int().min(0).max(4)).max(5),
      supported: z.boolean(),
      issue: z.string().max(300).default(''),
    }),
  ),
});
export type Review = z.infer<typeof reviewSchema>['answers'][number];

const REVIEWER = `You are the Reviewer in a multi-agent study system. You sit each draft question yourself, with only the numbered SOURCES in front of you. You have not seen the answer key.

For each question, work out the correct option indices (zero-based) from the sources alone. Set "supported" to false when the sources do not settle the answer, when the question is ambiguous, or when the number of correct options does not fit the question. Give the reason in "issue"; leave it empty otherwise.

Return JSON: {"answers": [{"index": 1, "correct": [0], "supported": true, "issue": ""}]}`;

export async function reviewQuestions(
  input: { drafts: Draft[]; hits: Hit[] },
  spend: Spend,
  signal?: AbortSignal,
): Promise<Review[]> {
  // The key and the explanation are withheld: the Reviewer must reach the answer alone.
  const paper = input.drafts
    .map((d, i) => `Q${i + 1}. ${d.text}\n${d.options.map((option, j) => `  (${j}) ${option}`).join('\n')}`)
    .join('\n\n');
  const { data, usage } = await chatJson(
    [
      { role: 'system', content: REVIEWER },
      { role: 'user', content: `SOURCES\n${formatSources(input.hits)}\n\nQUESTIONS\n${paper}` },
    ],
    reviewSchema,
    { temperature: 0, maxTokens: 90 * input.drafts.length + 200, signal },
  );
  spend(usage);
  return data.answers;
}

export interface Judgement {
  draft: Draft;
  accepted: boolean;
  reason: string;
}

const sameSet = (a: number[], b: number[]) => {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return left.length === right.length && left.every((value, i) => value === right[i]);
};

/**
 * A draft is kept only when it is well formed, the Reviewer could settle it from
 * the sources, and the Reviewer's answer matches the Examiner's key. Two agents
 * agreeing independently is the check; a disagreement is never resolved by guessing.
 */
export function judgeDrafts(drafts: Draft[], reviews: Review[], type: AuthoredType, sourceCount: number): Judgement[] {
  const byIndex = new Map(reviews.map((review) => [review.index, review]));
  return drafts.map((draft, i) => {
    const reject = (reason: string): Judgement => ({ draft, accepted: false, reason });
    const expectedOptions = type === 'TRUE_FALSE' ? 2 : 4;
    const correct = [...new Set(draft.correct)];

    if (draft.options.length !== expectedOptions) return reject(`Needs ${expectedOptions} options, has ${draft.options.length}.`);
    if (new Set(draft.options.map((o) => o.trim().toLowerCase())).size !== draft.options.length) {
      return reject('Two options are identical.');
    }
    if (correct.some((index) => index >= draft.options.length)) return reject('The answer key points at a missing option.');
    if (type === 'MULTIPLE' ? correct.length < 2 || correct.length === draft.options.length : correct.length !== 1) {
      return reject('The number of correct options does not fit the question type.');
    }
    if (draft.source > sourceCount) return reject('Cites a source that was not retrieved.');

    const review = byIndex.get(i + 1);
    if (!review) return reject('The Reviewer returned no answer for this question.');
    if (!review.supported) return reject(review.issue || 'The Reviewer could not settle the answer from the sources.');
    if (!sameSet(review.correct, correct)) return reject('The Reviewer reached a different answer from the key.');
    return { draft, accepted: true, reason: '' };
  });
}

/* ----------------------------------------------------------------- coach */

const COACH = `You are the Coach in a multi-agent study system. A student has finished a test. Using RESULT (their marks by topic and the questions they got wrong) and the numbered SOURCES (course material on their weak topics), write their debrief in Markdown.

1. One sentence on the result, with the score.
2. "## What went wrong": for each weak topic, the misunderstanding the wrong answers point to, corrected from the sources with citations such as [2].
3. "## Revise next": an ordered list of at most four concrete steps. Each names the lesson to reread, with its citation, and what the student should be able to do afterwards.

Address the student as "you". Be specific and direct. Cite only numbers that appear in SOURCES, and add no fact the sources do not contain. If SOURCES is empty, say the course has no indexed material for these topics and give only the result analysis.`;

export async function coach(
  input: { result: unknown; hits: Hit[] },
  spend: Spend,
  opts: { onToken?: (text: string) => void; signal?: AbortSignal } = {},
): Promise<string> {
  const reply = await getProvider().chat(
    [
      { role: 'system', content: COACH },
      {
        role: 'user',
        content: `RESULT\n${clip(JSON.stringify(input.result), 7000)}\n\nSOURCES\n${
          input.hits.length ? formatSources(input.hits) : '(none retrieved)'
        }`,
      },
    ],
    { temperature: 0.3, maxTokens: 1000, ...opts },
  );
  spend(reply.usage);
  return reply.text;
}

/** Which source numbers an answer actually cites, e.g. "[1]" or "[2, 4]". */
export function citedNumbers(text: string, sourceCount: number): Set<number> {
  const cited = new Set<number>();
  for (const match of text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const part of match[1].split(',')) {
      const n = Number(part.trim());
      if (n >= 1 && n <= sourceCount) cited.add(n);
    }
  }
  return cited;
}
