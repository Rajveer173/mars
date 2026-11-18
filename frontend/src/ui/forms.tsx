import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { Button, ErrorNote, Field, Input, Select, Spinner, Textarea } from './core';

export interface FormField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'date' | 'datetime-local' | 'textarea' | 'select';
  required?: boolean;
  hint?: string;
  min?: number;
  max?: number;
  step?: string;
  options?: { value: string; label: string }[];
}

/** Small, accessible forms share validation, pending and error handling. */
export function ActionForm({ fields, initial = {}, onSubmit, submitLabel = 'Save changes', children }: {
  fields: FormField[];
  initial?: Record<string, string>;
  onSubmit: (values: Record<string, string>) => Promise<unknown>;
  submitLabel?: string;
  children?: ReactNode;
}) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try { await onSubmit(values); } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    {error && <ErrorNote message={error} />}
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      {fields.map(field => {
        const props = { id: `${id}-${field.name}`, name: field.name, required: field.required,
          value: values[field.name] ?? '', onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues(previous => ({ ...previous, [field.name]: event.target.value })) };
        return <Field key={field.name} htmlFor={props.id} label={field.label} hint={field.hint} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
          {field.type === 'textarea' ? <Textarea {...props} /> : field.type === 'select' ? <Select {...props}><option value="">Choose…</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select> : <Input {...props} type={field.type ?? 'text'} min={field.min} max={field.max} step={field.step} />}
        </Field>;
      })}
    </fieldset>
    {children}
    <Button type="submit" loading={busy}>{submitLabel}</Button>
  </form>;
}

export function QueryState({ query, children }: { query: { isPending: boolean; error: Error | null; refetch: () => unknown }; children: ReactNode }) {
  if (query.isPending) return <Spinner />;
  if (query.error) return <ErrorNote message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  return <>{children}</>;
}

export const options = (values: string[]) => values.map(value => ({ value, label: value.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) }));
