import { dateLocale } from './i18n/t';

const df = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
const dfShort = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' });
const dtf = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const parse = (d: string) => (d.length === 10 ? new Date(d + 'T00:00:00') : new Date(d));
export const fmtDate = (d?: string | null) => (d ? df.format(parse(d)) : '—');
export const fmtDateShort = (d?: string | null) => (d ? dfShort.format(parse(d)) : '—');
export const fmtDateTime = (d?: string | null) => (d ? dtf.format(new Date(d)) : '—');

export function daysBetween(a: string, b: string) {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}
export function todayISO() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(dateLocale, { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.round(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 86400 * 7) return rtf.format(-Math.round(diff / 86400), 'day');
  return fmtDate(iso);
}
