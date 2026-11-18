import { cn, marks, titleCase } from '@/lib/format';
import type { Difficulty, QuestionType } from '@/lib/types';
import { Material } from '@/ui/Material';
import { Bubble } from '@/ui/core';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  difficulty: Difficulty;
  bloomLevel: string | null;
  marks: number;
  negativeMarks: number;
  explanation: string | null;
  correctAnswer: unknown;
  reference: string | null;
  topic: string | null;
  tags: string[];
  analytics: { attemptCount: number; accuracy: number } | null;
  options: { id: string; text: string; isCorrect: boolean; orderIndex: number }[];
  createdAt: string;
}

export interface QuestionBank {
  id: string;
  name: string;
  courseId: string | null;
  _count: { questions: number };
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE: 'Single answer',
  MULTIPLE: 'Multiple answers',
  TRUE_FALSE: 'True or false',
  FILL_BLANK: 'Fill in the blank',
  MATCH: 'Match',
  CODING: 'Coding',
  SUBJECTIVE: 'Written answer',
};

export const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];
const LETTERS = 'ABCDEFGH';

/** A question as it appears on paper, with the key shown: used wherever staff read a question. */
export function QuestionPaper({
  question,
  number,
  className,
}: {
  question: Pick<Question, 'text' | 'options' | 'explanation' | 'reference' | 'marks' | 'difficulty' | 'type' | 'correctAnswer'>;
  number?: number;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2', className)}>
      <span className="display nums text-xl text-ink-3">{number ?? ''}</span>
      <div className="min-w-0">
        <Material small>{question.text}</Material>
        {question.options.length > 0 ? (
          <ul className="mt-2.5 space-y-1.5">
            {[...question.options]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((option, i) => (
                <li key={option.id} className="flex items-start gap-3">
                  <Bubble letter={LETTERS[i]} state={option.isCorrect ? 'correct' : 'blank'} />
                  <span className={cn('pt-0.5 font-serif text-[0.9375rem] leading-relaxed', option.isCorrect ? 'text-ink' : 'text-ink-2')}>
                    {option.text}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          question.correctAnswer != null && (
            <p className="mt-2 text-base text-ink-2">
              Accepted answer:{' '}
              <span className="font-serif text-ink">
                {Array.isArray(question.correctAnswer) ? question.correctAnswer.join(' or ') : String(question.correctAnswer)}
              </span>
            </p>
          )
        )}
        {question.explanation && <p className="mt-3 border-l-[3px] border-mark pl-3 text-base leading-relaxed text-ink-2">{question.explanation}</p>}
        <p className="nums mt-2.5 text-sm text-ink-3">
          {[TYPE_LABEL[question.type], titleCase(question.difficulty), `${marks(question.marks)} marks`, question.reference && `from ${question.reference}`]
            .filter(Boolean)
            .join(', ')}
        </p>
      </div>
    </div>
  );
}
