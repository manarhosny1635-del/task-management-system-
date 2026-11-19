import Link from 'next/link';
import { t } from '@/lib/i18n/t';
import { fmtDate } from '@/lib/format';
import type { TaskRow } from '@/lib/types';
import { DeadlineText, Empty, Person, PriorityBadge, ProgressBar, StatusBadge } from './ui';
import { KANBAN_COLUMNS, STATUS_COLOR } from '@/lib/constants';

export function TaskTable({ tasks, hideAssignee }: { tasks: TaskRow[]; hideAssignee?: boolean }) {
  if (!tasks.length) return <div className="card"><Empty text={t('tasks.noTasks')} /></div>;
  return (
    <div className="card overflow-hidden">
      {/* desktop / tablet */}
      <div className="hidden overflow-x-auto scroll-thin md:block">
        <table className="w-full min-w-[960px]">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              <th className="th">{t('tasks.code')}</th><th className="th">{t('tasks.taskTitle')}</th>
              {!hideAssignee && <th className="th">{t('tasks.assignee')}</th>}
              <th className="th">{t('tasks.status')}</th><th className="th">{t('tasks.priority')}</th>
              <th className="th">{t('tasks.currentDeadline')}</th><th className="th">{t('tasks.progress')}</th>
              <th className="th">{t('tasks.project')}</th><th className="th">{t('tasks.assignedAt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {tasks.map((x) => (
              <tr key={x.id} className={`hover:bg-ink-50 ${x.is_overdue ? 'bg-red-50/40' : ''}`}>
                <td className="td whitespace-nowrap font-mono text-xs text-ink-500">{x.code}</td>
                <td className="td min-w-[240px] max-w-[360px]">
                  <Link href={`/tasks/${x.id}`} className="font-medium text-ink-900 hover:text-brand-700">{x.title}</Link>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-ink-500">
                    {x.has_pending_extension && <span className="badge bg-amber-50 text-amber-800 ring-amber-200">{t('extStatus.pending')}</span>}
                    {!x.assignee_id && x.suggested_assignee_name && <span>{t('tasks.suggested')} {x.suggested_assignee_name}</span>}
                  </div>
                </td>
                {!hideAssignee && <td className="td max-w-[220px]"><Person name={x.assignee_name} sub={x.department_name} /></td>}
                <td className="td"><StatusBadge status={x.status} /></td>
                <td className="td"><PriorityBadge priority={x.priority} /></td>
                <td className="td"><DeadlineText date={x.current_deadline} state={x.deadline_state} extended={x.deadline_extended} /></td>
                <td className="td"><ProgressBar value={x.progress} /></td>
                <td className="td text-sm text-ink-600">{x.project_name ?? '—'}</td>
                <td className="td whitespace-nowrap text-sm text-ink-600">{fmtDate(x.assigned_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* mobile cards */}
      <ul className="divide-y divide-ink-100 md:hidden">
        {tasks.map((x) => (
          <li key={x.id}>
            <Link href={`/tasks/${x.id}`} className="block p-4 hover:bg-ink-50">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-ink-900">{x.title}</div>
                <PriorityBadge priority={x.priority} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-ink-500">{x.code}</span><StatusBadge status={x.status} />
                <DeadlineText date={x.current_deadline} state={x.deadline_state} extended={x.deadline_extended} />
              </div>
              {!hideAssignee && <div className="mt-2"><Person name={x.assignee_name} /></div>}
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">{t('common.showing')} {tasks.length} {t('common.results')}</div>
    </div>
  );
}

export function Kanban({ tasks }: { tasks: TaskRow[] }) {
  const extra = tasks.some((x) => x.status === 'declined') ? ['declined' as const] : [];
  const cols = [...KANBAN_COLUMNS, ...extra];
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 scroll-thin">
      {cols.map((st) => {
        const items = tasks.filter((x) => x.status === st);
        return (
          <div key={st} className="w-72 shrink-0 rounded-xl bg-ink-100/70 p-2">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[st] }} />
              <span className="text-sm font-semibold text-ink-700">{t(`status.${st}`)}</span>
              <span className="ms-auto text-xs tabular-nums text-ink-500">{items.length}</span>
            </div>
            <div className="mt-1 max-h-[70vh] space-y-2 overflow-y-auto scroll-thin">
              {items.map((x) => (
                <Link key={x.id} href={`/tasks/${x.id}`} className={`block rounded-lg border bg-white p-3 shadow-sm hover:border-brand-300 ${x.is_overdue ? 'border-red-200' : 'border-ink-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-snug text-ink-900">{x.title}</span>
                    <PriorityBadge priority={x.priority} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-ink-400">{x.code}</span>
                    <DeadlineText date={x.current_deadline} state={x.deadline_state} />
                  </div>
                  <div className="mt-2"><Person name={x.assignee_name} /></div>
                </Link>
              ))}
              {!items.length && <div className="px-2 py-4 text-center text-xs text-ink-400">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
