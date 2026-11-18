import { cn } from '@/lib/format';

/** One place for the product's name, so a rename is a one-line change. */
export const APP = {
  short: 'MARS',
  full: 'Multi-Agentic RAG System',
  institute: 'Meridian Institute of Technology',
} as const;

/** The mark: a letter with a highlighter stroke through it, which is what the product does. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-ink" />
      <path d="M5 21.5 26.5 18l.5 6.5L5.5 27z" className="fill-mark" />
      <path d="M8 23V9h3.2l4.8 8 4.8-8H24v14h-3V14.4L16.9 21h-1.8L11 14.4V23z" fill="#fff" />
    </svg>
  );
}

export function Brand({ descriptor = false, className }: { descriptor?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Mark />
      <span className="flex flex-col leading-none">
        <span className="display text-lg tracking-normal text-ink">{APP.short}</span>
        {descriptor && <span className="mt-1 text-xs text-ink-2">{APP.full}</span>}
      </span>
    </span>
  );
}
