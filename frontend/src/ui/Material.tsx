import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/format';

const CITE_HREF = '#cite-';

/**
 * Rewrites "[2]" and "[1, 3]" into links the renderer turns into citation
 * markers. Code spans and fenced blocks are skipped: `arr[0]` is not a citation.
 */
function linkCitations(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((segment, i) =>
      i % 2
        ? segment
        : segment.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (_, list: string) =>
            list
              .split(',')
              .map((n) => `[${n.trim()}](${CITE_HREF}${n.trim()})`)
              .join(''),
          ),
    )
    .join('');
}

interface MaterialProps {
  children: string;
  /** Set when the text can carry citations; called with the source number. */
  onCite?: (n: number) => void;
  activeCite?: number | null;
  small?: boolean;
  className?: string;
}

/** Renders Markdown in the reading serif: lessons, questions and agent answers. */
export const Material = memo(function Material({ children, onCite, activeCite, small, className }: MaterialProps) {
  const source = useMemo(() => (onCite ? linkCitations(children) : children), [children, onCite]);
  return (
    <div className={cn('material', small && 'material-sm', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children: label }) {
            if (href?.startsWith(CITE_HREF) && onCite) {
              const n = Number(href.slice(CITE_HREF.length));
              return (
                <button
                  type="button"
                  className="cite"
                  data-active={activeCite === n}
                  aria-label={`Source ${n}`}
                  onClick={() => onCite(n)}
                >
                  {n}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {label}
              </a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
