import { Check, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP, Brand } from '@/app/Brand';
import { ROLE_HOME, useAuth } from '@/lib/auth';
import { LinkButton } from '@/ui/core';

/**
 * The specimen in the hero is the product's own answer layout with fixed
 * content, so a visitor sees the real thing before signing in: an answer, the
 * passage it cites, and the agents that produced it.
 */
function Specimen() {
  const steps = [
    { agent: 'Supervisor', did: 'Course material', time: '0.6 s' },
    { agent: 'Retriever', did: '6 passages found', time: '41 ms' },
    { agent: 'Tutor', did: '2 passages cited', time: '2.1 s' },
    { agent: 'Verifier', did: 'All claims supported', time: '0.9 s' },
  ];
  return (
    <figure className="overflow-hidden rounded-xl border-[1.5px] border-ink bg-paper">
      <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-2.5 text-sm">
        <span className="font-medium text-ink">CS302 Operating Systems</span>
        <span className="text-ink-3">Sample run from the demo course</span>
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6">
        <p className="text-base font-semibold text-pen-deep">Which conditions must hold for a deadlock to occur?</p>
        <div className="material mt-3">
          <p>
            A deadlock can occur only when four conditions hold at the same time: mutual exclusion, hold and wait, no
            preemption and circular wait
            <span className="cite">1</span>. Break any one of them and a deadlock is impossible, which is why prevention
            schemes attack the conditions one at a time
            <span className="cite">2</span>.
          </p>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-tick">
          <ShieldCheck className="size-3.5" aria-hidden />
          Verified: every claim is in the cited sources.
        </p>
      </div>

      <div className="grid border-t border-rule sm:grid-cols-[1.15fr_1fr]">
        <div className="border-b border-rule px-5 py-4 sm:border-b-0 sm:border-r sm:px-6">
          <div className="mb-2.5 text-sm font-medium text-ink-2">Run sheet</div>
          <ol className="space-y-2 text-sm">
            {steps.map((step) => (
              <li key={step.agent} className="flex items-baseline gap-2">
                <Check className="size-3.5 shrink-0 translate-y-0.5 text-tick" strokeWidth={3} aria-hidden />
                <span className="w-[4.75rem] shrink-0 font-semibold text-ink">{step.agent}</span>
                <span className="min-w-0 flex-1 text-ink-2">{step.did}</span>
                <span className="nums shrink-0 text-ink-3">{step.time}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <div className="flex items-baseline gap-2">
            <span className="cite !m-0">1</span>
            <span className="text-sm font-semibold text-ink">Deadlocks</span>
            <span className="text-sm text-ink-2">Necessary conditions</span>
          </div>
          <p className="mt-2 font-serif text-sm leading-relaxed text-ink">
            A deadlock can arise only if{' '}
            <span className="hl animate-sweep [animation-delay:0.5s]">
              all four of the following conditions hold simultaneously
            </span>
            : mutual exclusion, hold and wait, no preemption, and circular wait.
          </p>
          <p className="nums mt-2 text-xs text-ink-3">keyword #1, meaning #1</p>
        </div>
      </div>
    </figure>
  );
}

const RUN = [
  {
    agent: 'Supervisor',
    job: 'Reads the question and decides who handles it: course material, your own records, or both. It writes the search queries. It never answers.',
    shows: 'Route and queries',
  },
  {
    agent: 'Retriever',
    job: 'Searches every passage you are allowed to read, twice: once by keyword, once by meaning. The two rankings are fused into one.',
    shows: 'Each passage with both ranks',
  },
  {
    agent: 'Tutor',
    job: 'Writes the answer from those passages only, and pins each sentence to the passage it came from.',
    shows: 'The answer, cited',
  },
  {
    agent: 'Verifier',
    job: 'Re-reads the answer against the passages. If a claim is not in them, the answer goes back to be rewritten.',
    shows: 'Verdict and rejected claims',
  },
];

const PIPELINES = [
  { label: 'For', values: ['Students and staff', 'Teachers', 'Students'] },
  { label: 'You give it', values: ['A question', 'A topic and how many questions', 'A finished test'] },
  {
    label: 'Agents, in order',
    values: ['Supervisor, Retriever, Tutor, Verifier', 'Retriever, Examiner, Reviewer, Librarian', 'Records, Retriever, Coach'],
  },
  {
    label: 'You get',
    values: [
      'An answer with every sentence cited to a lesson',
      'Questions two agents agreed on, filed in your bank',
      'What went wrong by topic, and which lessons to reread',
    ],
  },
];

const REFUSALS = [
  {
    title: 'It does not answer without a source.',
    body: 'When retrieval finds nothing, no model is called. You are told the material is missing instead of being handed a guess.',
  },
  {
    title: 'It does not keep a question two agents disagree on.',
    body: 'The Reviewer sits every drafted question without the answer key. A different answer, or an ambiguous question, is rejected with the reason.',
  },
  {
    title: 'It does not show a student another course.',
    body: 'Retrieval is scoped in code to the courses a student is enrolled in. The model never sees a passage the reader could not open.',
  },
  {
    title: 'It does not hide its work.',
    body: 'Every agent step is stored with its timing, its token count and its evidence, and you can open any of them.',
  },
];

const PLATFORM = [
  'Courses, modules and lessons',
  'Question bank with versions',
  'Timed tests on an answer sheet',
  'Automatic and manual grading',
  'Results and item analysis',
  'Assignments and feedback',
  'Coding problems with test cases',
  'Proctoring sessions and flags',
  'Placement drives and eligibility',
  'Audit log and session control',
];

export function Landing() {
  const user = useAuth((state) => state.user);
  const enter = user ? ROLE_HOME[user.role] : '/sign-in';

  return (
    <div className="bg-paper">
      <header className="mx-auto flex h-16 max-w-page items-center justify-between gap-6 px-5 sm:px-8">
        <Link to="/" aria-label={`${APP.short} home`}>
          <Brand descriptor />
        </Link>
        <nav className="flex items-center gap-1 text-base" aria-label="Site">
          <a href="#run" className="hidden rounded-md px-3 py-1.5 text-ink-2 hover:text-ink sm:block">
            How a run works
          </a>
          <a href="#pipelines" className="hidden rounded-md px-3 py-1.5 text-ink-2 hover:text-ink sm:block">
            Pipelines
          </a>
          <LinkButton to={enter} variant="secondary" size="sm" className="ml-2">
            {user ? 'Open the app' : 'Sign in'}
          </LinkButton>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-page items-center gap-x-12 gap-y-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1fr_1.08fr] lg:pb-28 lg:pt-16">
          <div>
            <h1 className="display text-5xl text-ink sm:text-6xl xl:text-7xl">Every answer shows the page it came from.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              {APP.short} is a multi-agent RAG system for colleges. A team of agents reads your course material, answers
              with the passage highlighted, writes exam questions a second agent has to pass, and turns each finished
              test into a revision plan.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <LinkButton to={enter} size="lg">
                {user ? 'Open the app' : 'Open the demo'}
              </LinkButton>
              <a href="#run" className="text-md font-medium text-pen underline-offset-4 hover:underline">
                See how a run works
              </a>
            </div>
          </div>
          <Specimen />
        </section>

        <section id="run" className="scroll-mt-8 border-t border-rule">
          <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
            <h2 className="display max-w-2xl text-4xl text-ink">One question, four agents, each checking the one before.</h2>
            <p className="mt-4 max-w-2xl text-md text-ink-2">
              The order is fixed in code. The Supervisor only picks the branch, so a run costs at most four model calls
              and can be replayed from its record.
            </p>
            <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {RUN.map((step, index) => (
                <li key={step.agent} className="relative border-t-[1.5px] border-ink pt-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="display text-2xl text-ink">{step.agent}</h3>
                    <span className="nums text-sm text-ink-3">
                      {index + 1} of {RUN.length}
                    </span>
                  </div>
                  <p className="mt-2 text-base leading-relaxed text-ink-2">{step.job}</p>
                  <p className="mt-3 text-sm text-ink">
                    <span className="hl">On the run sheet</span> {step.shows.toLowerCase()}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pipelines" className="scroll-mt-8 border-t border-rule bg-desk">
          <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
            <h2 className="display max-w-2xl text-4xl text-ink">Three pipelines, one knowledge base.</h2>
            <p className="mt-4 max-w-2xl text-md text-ink-2">
              Every lesson is indexed the moment it is saved. Teachers add PDFs and notes beside it. All three pipelines
              read from the same passages.
            </p>
            <div className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left text-base">
                <thead>
                  <tr className="border-b-[1.5px] border-ink">
                    <th className="w-40 pb-3 font-normal text-ink-3" />
                    {['Ask', 'Author', 'Debrief'].map((name) => (
                      <th key={name} className="display pb-3 pr-6 text-2xl text-ink">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PIPELINES.map((row) => (
                    <tr key={row.label} className="border-b border-rule align-top">
                      <th scope="row" className="py-3.5 pr-6 text-sm font-medium text-ink-2">
                        {row.label}
                      </th>
                      {row.values.map((value) => (
                        <td key={value} className="py-3.5 pr-6 text-ink">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-rule">
          <div className="mx-auto grid max-w-page gap-x-16 gap-y-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="display text-4xl text-ink">What it will not do.</h2>
              <p className="mt-4 max-w-md text-md text-ink-2">
                A system that marks students has to be checkable. These four rules are enforced in code, not asked of
                the model.
              </p>
            </div>
            <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {REFUSALS.map((item) => (
                <div key={item.title}>
                  <dt className="text-md font-semibold leading-snug text-ink">{item.title}</dt>
                  <dd className="mt-1.5 text-base leading-relaxed text-ink-2">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t border-rule">
          <div className="mx-auto grid max-w-page gap-x-16 gap-y-8 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="display text-4xl text-ink">Built into a full exam platform.</h2>
              <p className="mt-4 max-w-md text-md text-ink-2">
                The agents work on real coursework: the lessons students read, the tests they sit and the marks they
                get.
              </p>
              <LinkButton to={enter} className="mt-6">
                {user ? 'Open the app' : 'Open the demo'}
              </LinkButton>
            </div>
            <ul className="grid content-start gap-x-10 text-base text-ink sm:grid-cols-2">
              {PLATFORM.map((item) => (
                <li key={item} className="border-b border-rule py-2.5">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-3 sm:px-8">
          <Brand descriptor />
          <p>{APP.institute} is a fictional institute. All people and results in the demo are generated.</p>
        </div>
      </footer>
    </div>
  );
}
