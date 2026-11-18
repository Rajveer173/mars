export { clsx as cn } from 'clsx';

const DAY = 86_400_000;
const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'long' });

type When = string | number | Date | null | undefined;
const toDate = (value: When) => (value == null ? null : new Date(value));

export const formatDate = (value: When) => {
  const d = toDate(value);
  return d ? date.format(d) : 'Not set';
};

export const formatDateTime = (value: When) => {
  const d = toDate(value);
  return d ? `${dateShort.format(d)}, ${time.format(d)}` : 'Not set';
};

export const formatTime = (value: When) => {
  const d = toDate(value);
  return d ? time.format(d) : '';
};

/** "in 3 days", "2 hours ago", "today at 4:30 pm": whichever a person would say. */
export function relative(value: When, now = Date.now()): string {
  const d = toDate(value);
  if (!d) return 'Not set';
  const diff = d.getTime() - now;
  const abs = Math.abs(diff);
  const say = (n: number, unit: string) => {
    const label = `${n} ${unit}${n === 1 ? '' : 's'}`;
    return diff >= 0 ? `in ${label}` : `${label} ago`;
  };
  if (abs < 60_000) return diff >= 0 ? 'in a moment' : 'just now';
  if (abs < 3_600_000) return say(Math.round(abs / 60_000), 'minute');
  if (abs < DAY) return say(Math.round(abs / 3_600_000), 'hour');
  if (abs < 7 * DAY) return say(Math.round(abs / DAY), 'day');
  return date.format(d);
}

export const dayName = (value: When) => {
  const d = toDate(value);
  return d ? weekday.format(d) : '';
};

export const formatDuration = (seconds: number | null | undefined) => {
  if (seconds == null) return 'Not recorded';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min${s && m < 10 ? ` ${s} s` : ''}`;
  return `${s} s`;
};

export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return `${h ? `${h}:` : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

export const formatMs = (ms: number | null | undefined) =>
  ms == null ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

const number = new Intl.NumberFormat('en-IN');
export const formatNumber = (value: number | null | undefined) => (value == null ? '0' : number.format(value));

export const percent = (value: number | null | undefined, digits = 0) =>
  value == null ? 'No data' : `${Number(value).toFixed(digits)}%`;

/** 12.50 -> "12.5", 12.00 -> "12": marks read better without trailing zeros. */
export const marks = (value: number | string | null | undefined) =>
  value == null ? '0' : String(Math.round(Number(value) * 100) / 100);

export const initials = (name: string | null | undefined) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

export const titleCase = (value: string | null | undefined) =>
  (value ?? '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;
