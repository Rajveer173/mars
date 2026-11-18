import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn, initials } from '@/lib/format';

/* ---------------------------------------------------------------- buttons */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-45';
const BUTTON_VARIANT: Record<Variant, string> = {
  // Ink at rest, ballpoint under the cursor: pressing it is the user writing.
  primary: 'bg-ink text-white hover:bg-pen',
  secondary: 'border border-rule bg-paper text-ink hover:border-ink',
  ghost: 'text-ink-2 hover:bg-desk hover:text-ink',
  danger: 'bg-red text-white hover:bg-red/90',
};
const BUTTON_SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-3.5 text-base',
  lg: 'h-11 px-5 text-md',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({ variant, size, className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconButton({ label, className, children, type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-desk hover:text-ink disabled:opacity-40',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

/* ------------------------------------------------------------------ forms */

// What the user types is set in ballpoint blue: it is their writing on the sheet.
const CONTROL =
  'w-full rounded-md border border-rule bg-paper px-3 text-base text-pen-deep placeholder:text-ink-3 transition-[border-color,box-shadow] hover:border-ink-3 focus:border-pen focus:outline-none focus:ring-[3px] focus:ring-pen-wash disabled:bg-desk disabled:text-ink-3 aria-[invalid=true]:border-red';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(CONTROL, 'h-9', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(CONTROL, 'py-2 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        CONTROL,
        'h-9 appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234A5473' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-base', disabled && 'cursor-not-allowed opacity-50')}>
      <span className="relative mt-0.5 inline-flex size-4 shrink-0">
        <input
          type="checkbox"
          className="peer size-4 cursor-pointer appearance-none rounded-sm border border-ink-3 bg-paper checked:border-pen checked:bg-pen"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <Check className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-white peer-checked:block" strokeWidth={3} />
      </span>
      <span>{label}</span>
    </label>
  );
}

/* ----------------------------------------------------------------- status */

export type Tone = 'neutral' | 'pen' | 'mark' | 'red' | 'tick';

const TAG_TONE: Record<Tone, string> = {
  neutral: 'bg-desk text-ink-2',
  pen: 'bg-pen-wash text-pen-deep',
  mark: 'bg-mark text-ink',
  red: 'bg-red-wash text-red',
  tick: 'bg-tick-wash text-tick',
};

/** A small rectangular label. Use it for a state that needs to stand out, not on every row. */
export function Tag({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center whitespace-nowrap rounded-sm px-1.5 text-xs font-medium', TAG_TONE[tone], className)}>
      {children}
    </span>
  );
}

const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  pen: 'bg-pen',
  mark: 'bg-mark ring-1 ring-ink/25',
  red: 'bg-red',
  tick: 'bg-tick',
};

/** State as plain text with a coloured dot: the quiet default for table rows. */
export function Status({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-base text-ink">
      <span className={cn('size-1.5 rounded-full', DOT_TONE[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2.5 py-10 text-base text-ink-2">
      <Loader2 className="size-4 animate-spin text-pen" aria-hidden />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-rule-2', className)} aria-hidden />;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-red/30 bg-red-wash px-3.5 py-3 text-base text-ink">
      <X className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="font-medium text-pen underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

/** An empty screen says what belongs here and how to put it there. */
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="max-w-md py-12">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1.5 text-base leading-relaxed text-ink-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- layout */

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="display text-3xl text-ink sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-md text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-baseline justify-between gap-4', className)}>
      <h2 className="display text-xl text-ink">{children}</h2>
      {aside && <div className="text-sm text-ink-2">{aside}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-lg border border-rule bg-paper', className)}>{children}</section>;
}

/** A figure with its label: the building block of every summary strip. */
export function Figure({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'red' | 'tick';
}) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-ink-2">{label}</div>
      <div className={cn('display nums mt-1 text-4xl', tone === 'red' ? 'text-red' : tone === 'tick' ? 'text-tick' : 'text-ink')}>
        {value}
      </div>
      {note && <div className="mt-1 text-sm text-ink-3">{note}</div>}
    </div>
  );
}

export function FigureRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-8 gap-y-6 border-t-[1.5px] border-ink pt-5 sm:grid-cols-4', className)}>
      {children}
    </div>
  );
}

export function Meter({ value, tone = 'ink', className }: { value: number; tone?: 'ink' | 'pen' | 'tick' | 'red'; className?: string }) {
  const fill = { ink: 'bg-ink', pen: 'bg-pen', tick: 'bg-tick', red: 'bg-red' }[tone];
  return (
    <div
      className={cn('h-1.5 overflow-hidden rounded-full bg-rule-2', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full', fill)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'size-6 text-[0.625rem]', md: 'size-8 text-xs', lg: 'size-11 text-base' }[size];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-white', box)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ table */

export interface Column<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  empty?: ReactNode;
}) {
  if (!rows.length) return <>{empty ?? <Empty title="Nothing here yet" />}</>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap border-b-[1.5px] border-ink pb-2 pr-6 text-sm font-medium text-ink-2 last:pr-0',
                  column.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (event) => event.key === 'Enter' && onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn('border-b border-rule-2', onRowClick && 'cursor-pointer hover:bg-desk')}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'py-2.5 pr-6 align-middle last:pr-0',
                    column.align === 'right' && 'nums text-right',
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------- tabs */

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex gap-6 overflow-x-auto border-b border-rule', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-base transition-colors',
              active ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {item.label}
            {item.count != null && <span className="nums text-sm font-normal text-ink-3">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------- answer bubble */

/**
 * An OMR bubble. Filled in ballpoint when the candidate chooses it; in review it
 * carries the examiner's verdict instead.
 */
export function Bubble({
  letter,
  state = 'blank',
}: {
  letter: string;
  state?: 'blank' | 'filled' | 'correct' | 'wrong' | 'missed';
}) {
  const look = {
    blank: 'border-ink-3 text-ink-2',
    filled: 'border-pen bg-pen text-white',
    correct: 'border-tick bg-tick text-white',
    wrong: 'border-red bg-red text-white',
    // The right answer the candidate did not choose: outlined, not filled.
    missed: 'border-tick text-tick',
  }[state];
  return (
    <span
      className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-sm font-semibold', look)}
      aria-hidden
    >
      {state === 'correct' ? <Check className="size-3.5" strokeWidth={3} /> : state === 'wrong' ? <X className="size-3.5" strokeWidth={3} /> : letter}
    </span>
  );
}
