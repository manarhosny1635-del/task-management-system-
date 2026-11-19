import ar, { type Dict } from './ar';
import en from './en';

export type Locale = 'ar' | 'en';
export const LOCALES: Record<Locale, { dir: 'rtl' | 'ltr'; dateLocale: string }> = {
  ar: { dir: 'rtl', dateLocale: 'ar-EG' },
  en: { dir: 'ltr', dateLocale: 'en-GB' },
};

export const defaultLocale: Locale = (process.env.NEXT_PUBLIC_DEFAULT_LOCALE as Locale) === 'en' ? 'en' : 'ar';

const dicts: Record<Locale, unknown> = { ar, en };

function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export type TFn = (key: string, vars?: Record<string, string | number | null | undefined>) => string;

export function makeT(locale: Locale = defaultLocale): TFn {
  return (key, vars) => {
    let s = lookup(dicts[locale], key) ?? lookup(ar, key);
    if (typeof s !== 'string') s = key;
    let out = s as string;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v == null ? '' : String(v));
    return out;
  };
}

/** Translate a database error message ("err.key" or "err.key|row") */
export function errorText(t: TFn, message?: string | null): string {
  if (!message) return t('err.generic');
  const m = message.match(/err\.([a-z_]+)(?:\|(\d+))?/);
  if (m) return t(`err.${m[1]}`, { row: m[2] });
  if (/duplicate key/i.test(message)) return t('err.duplicate');
  return message;
}

export type { Dict };
