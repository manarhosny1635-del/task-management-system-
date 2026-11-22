import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '@/lib/i18n/t';
import { STATUS_BADGE, PRIORITY_BADGE, DEADLINE_BADGE, EXT_BADGE } from '@/lib/constants';
import type { TaskStatus, Priority, DeadlineState, ExtStatus } from '@/lib/types';
import { fmtDate } from '@/lib/format';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '', bodyClass = 'p-4' }:
  { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-brand-100 px-4 py-3.5">
          <h2 className="section-title">{title}</h2>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge ${STATUS_BADGE[status]}`}>{t(`status.${status}`)}</span>;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge ${PRIORITY_BADGE[priority]}`}>{t(`priority.${priority}`)}</span>;
}
export function ExtBadge({ status }: { status: ExtStatus }) {
  return <span className={`badge ${EXT_BADGE[status]}`}>{t(`extStatus.${status}`)}</span>;
}
export function DeadlineText({ date, state, extended }: { date: string | null; state: DeadlineState; extended?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-sm ${DEADLINE_BADGE[state]}`}>
      {state === 'overdue' && <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />}
      {fmtDate(date)}
      {extended && <span className="badge bg-brand-100 text-brand-700 ring-brand-200">{t('tasks.extended')}</span>}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-brand-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-ink-500">{value}%</span>
    </div>
  );
}

export function Empty({ text, action }: { text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center text-sm text-ink-500">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      </span>
      {text ?? t('common.empty')}
      {action}
    </div>
  );
}

export function Kpi({ label, value, href, tone = 'default', icon, sub }:
  { label: string; value: number | string; href?: string; tone?: 'default' | 'warn' | 'danger' | 'good' | 'brand'; icon?: ReactNode; sub?: ReactNode }) {
  const toneCls = { default: 'text-ink-900', warn: 'text-amber-700', danger: 'text-rose-700', good: 'text-[#3F8A5C]', brand: 'text-brand-700' }[tone];
  const chip = { default: 'bg-brand-100 text-brand-700', warn: 'bg-amber-50 text-amber-700', danger: 'bg-rose-100 text-rose-700', good: 'bg-green-50 text-[#3F8A5C]', brand: 'bg-brand-100 text-brand-700' }[tone];
  const inner = (
    <div className={`card flex h-full items-center gap-3 p-4 transition ${href ? 'hover:border-brand-300 hover:shadow-md active:scale-[0.99]' : ''} ${tone === 'danger' && value ? 'border-rose-200 bg-rose-50/40' : ''}`}>
      {icon && <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chip}`}>{icon}</span>}
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-ink-500">{label}</div>
        <div className={`mt-0.5 text-2xl font-bold leading-tight tabular-nums ${toneCls}`}>{value}</div>
        {sub && <div className="truncate text-[11px] text-ink-500">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// avatar tones drawn from the palette family
const AVATAR_TONES: [string, string][] = [['#5D6B6B', '#fff'], ['#C0D9D9', '#283030'], ['#F7CBCA', '#7A3332'], ['#D9D0D0', '#4A3F3F'], ['#7A8C8C', '#fff'], ['#D5E5E5', '#3A4444'], ['#4B5757', '#fff']];

export function Avatar({ name, size = 28 }: { name?: string | null; size?: number }) {
  const initials = (name ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('');
  let h = 0; for (const c of name ?? '') h = (h * 31 + c.charCodeAt(0)) % AVATAR_TONES.length;
  const [bg, fg] = AVATAR_TONES[h];
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-white"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.max(10, size * 0.36) }}>{initials}</span>
  );
}

export function Person({ name, sub }: { name?: string | null; sub?: string | null }) {
  if (!name) return <span className="text-ink-400">{t('common.unassigned')}</span>;
  return (
    <span className="inline-flex max-w-full items-center gap-2" title={name}>
      <Avatar name={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink-900">{name}</span>
        {sub && <span className="block truncate text-xs text-ink-500">{sub}</span>}
      </span>
    </span>
  );
}
