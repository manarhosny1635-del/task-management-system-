import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '@/lib/i18n/t';
import { STATUS_BADGE, PRIORITY_BADGE, DEADLINE_BADGE, EXT_BADGE } from '@/lib/constants';
import type { TaskStatus, Priority, DeadlineState, ExtStatus } from '@/lib/types';
import { fmtDate } from '@/lib/format';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h1>
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
        <header className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
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
      {state === 'overdue' && <span className="h-1.5 w-1.5 rounded-full bg-red-600" />}
      {fmtDate(date)}
      {extended && <span className="badge bg-sky-50 text-sky-700 ring-sky-200">{t('tasks.extended')}</span>}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-ink-500">{value}%</span>
    </div>
  );
}

export function Empty({ text, action }: { text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-sm text-ink-500">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-300">
        <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
      {text ?? t('common.empty')}
      {action}
    </div>
  );
}

export function Kpi({ label, value, href, tone = 'default' }: { label: string; value: number | string; href?: string; tone?: 'default' | 'warn' | 'danger' | 'good' | 'brand' }) {
  const toneCls = { default: 'text-ink-900', warn: 'text-amber-600', danger: 'text-red-600', good: 'text-green-600', brand: 'text-brand-600' }[tone];
  const inner = (
    <div className="card h-full p-4 transition hover:border-brand-200 hover:shadow-md">
      <div className="text-xs font-medium text-ink-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Avatar({ name, size = 28 }: { name?: string | null; size?: number }) {
  const initials = (name ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('');
  let h = 0; for (const c of name ?? '') h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ width: size, height: size, background: `hsl(${h} 45% 48%)` }}>{initials}</span>
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
