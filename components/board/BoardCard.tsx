'use client';
import { t } from '@/lib/i18n/t';
import { fmtDateShort } from '@/lib/format';
import { PRIORITY_DOT } from '@/lib/constants';
import type { BoardTask } from './Board';
import { Avatar, StatusBadge } from '../ui';
import { Icon } from '../Shell';

export function BoardCard({ task: x, saving, landed, onPointerDown, onOpen }:
  { task: BoardTask; saving: boolean; landed: boolean; onPointerDown: (e: React.PointerEvent<HTMLElement>) => void; onOpen: (e: React.MouseEvent<HTMLElement>) => void }) {
  const late = x.is_overdue;
  const soon = x.deadline_state === 'due_soon';
  return (
    <article
      role="button" tabIndex={0} aria-label={`${x.code} ${x.title}`}
      onPointerDown={onPointerDown} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(e as unknown as React.MouseEvent<HTMLElement>); } }}
      className={`group relative cursor-grab select-none rounded-xl border bg-white p-3 shadow-card transition-[box-shadow,border-color,transform] duration-150
        hover:border-brand-300 hover:shadow-md active:cursor-grabbing focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300
        ${late ? 'border-rose-300' : 'border-brand-200'} ${landed ? 'anim-pop ring-2 ring-brand-500' : ''} ${saving ? 'pointer-events-none' : ''}`}>
      {late && <span className="absolute inset-y-3 start-0 w-1 rounded-e-full bg-rose-500" aria-hidden />}

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-600">
          <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_DOT[x.priority] }} />{t(`priority.${x.priority}`)}
        </span>
        <span className="font-mono text-[10px] text-ink-400">{x.code}</span>
        <span data-drag-handle className="ms-auto -me-1 cursor-grab touch-none rounded-md p-1 text-ink-300 transition hover:bg-brand-100 hover:text-ink-600" aria-label={t('board.dragHandle')} title={t('board.dragHandle')}>
          <Icon name="grip" className="h-4 w-4" />
        </span>
      </div>

      <h3 className="mt-1.5 line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink-900">{x.title}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {x.project_name && (
          <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-brand-100 px-1.5 py-0.5 text-[11px] font-medium text-brand-800">
            <Icon name="folder" className="h-3 w-3 shrink-0" /><span className="truncate">{x.project_name}</span>
          </span>
        )}
        <StatusBadge status={x.status} />
        {x.has_pending_extension && <span className="badge bg-amber-50 text-amber-800 ring-amber-200">{t('extStatus.pending')}</span>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-brand-100 pt-2.5">
        {x.assignee_name ? (
          <span className="inline-flex min-w-0 items-center gap-1.5" title={x.assignee_name}>
            <Avatar name={x.assignee_name} size={22} />
            <span className="truncate text-xs text-ink-700">{x.assignee_name.split(' ').slice(0, 2).join(' ')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-400"><Icon name="user" className="h-4 w-4" />
            {x.suggested_assignee_name ? `${t('tasks.suggested')} ${x.suggested_assignee_name.split(' ')[0]}` : t('board.unassigned')}</span>
        )}
        {x.current_deadline && (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold
            ${late ? 'bg-rose-200 text-rose-700' : soon ? 'bg-amber-50 text-amber-800' : x.status === 'completed' ? 'bg-green-50 text-green-800' : 'text-ink-500'}`}>
            <Icon name={late ? 'alert' : 'calendar'} className="h-3.5 w-3.5" />
            {late ? `${t('board.overdue')} · ` : ''}{fmtDateShort(x.current_deadline)}
          </span>
        )}
      </div>

      {saving && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 text-xs font-semibold text-brand-700">
          <span className="me-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />{t('board.saving')}
        </div>
      )}
    </article>
  );
}
