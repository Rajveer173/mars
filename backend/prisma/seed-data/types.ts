// Shapes shared by the seed content files. Content stays plain data; seed.ts
// decides marks, ids, dates and everything else that is derived.

export type Diff = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
export type Bloom = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
export type QType = 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SUBJECTIVE';

export interface SeedLesson {
  title: string;
  /** Short label that questions reuse, so results can be grouped by lesson. */
  topic: string;
  durationMin: number;
  /** Markdown lecture notes. */
  content: string;
}

export interface SeedModule {
  title: string;
  description: string;
  lessons: SeedLesson[];
}

export interface SeedQuestion {
  topic: string;
  type: QType;
  difficulty: Diff;
  bloom: Bloom;
  text: string;
  /** SINGLE / MULTIPLE / TRUE_FALSE option texts, in display order. */
  options: string[];
  /** Indexes into `options` that are correct. */
  correct: number[];
  /** FILL_BLANK: every accepted answer (compared case- and space-insensitively). */
  accepted: string[];
  /** FILL_BLANK: plausible wrong answers a student might type. */
  distractors: string[];
  /** SUBJECTIVE: sample student answers by quality, used for seeded attempts. */
  samples?: { good: string; partial: string; weak: string };
  explanation: string;
  tags: string[];
}

const base = (
  type: QType, topic: string, difficulty: Diff, bloom: Bloom, text: string, explanation: string, tags: string[],
): SeedQuestion => ({ type, topic, difficulty, bloom, text, explanation, tags, options: [], correct: [], accepted: [], distractors: [] });

export const single = (
  topic: string, difficulty: Diff, bloom: Bloom, text: string, options: [string, string, string, string],
  correct: number, explanation: string, tags: string[],
): SeedQuestion => ({ ...base('SINGLE', topic, difficulty, bloom, text, explanation, tags), options, correct: [correct] });

export const multi = (
  topic: string, difficulty: Diff, bloom: Bloom, text: string, options: [string, string, string, string],
  correct: number[], explanation: string, tags: string[],
): SeedQuestion => ({ ...base('MULTIPLE', topic, difficulty, bloom, text, explanation, tags), options, correct });

export const tf = (
  topic: string, difficulty: Diff, bloom: Bloom, text: string, answer: boolean, explanation: string, tags: string[],
): SeedQuestion => ({
  ...base('TRUE_FALSE', topic, difficulty, bloom, text, explanation, tags),
  options: ['True', 'False'],
  correct: [answer ? 0 : 1],
});

export const fill = (
  topic: string, difficulty: Diff, bloom: Bloom, text: string, accepted: string[], distractors: string[],
  explanation: string, tags: string[],
): SeedQuestion => ({ ...base('FILL_BLANK', topic, difficulty, bloom, text, explanation, tags), accepted, distractors });

export const subj = (
  topic: string, difficulty: Diff, bloom: Bloom, text: string, explanation: string,
  samples: { good: string; partial: string; weak: string }, tags: string[],
): SeedQuestion => ({ ...base('SUBJECTIVE', topic, difficulty, bloom, text, explanation, tags), samples });
