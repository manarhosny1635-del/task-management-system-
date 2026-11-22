'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { t } from '@/lib/i18n/t';
import { getTaskBundle, type TaskBundle } from '@/lib/taskBundle';
import { useOnChanged } from '@/lib/events';
import { fmtDate, fmtDateTime, daysBetween } from '@/lib/format';
import { DeadlineText, ExtBadge, Person, PriorityBadge, ProgressBar, StatusBadge } from '../ui';
import { Timeline } from '../Activity';
import { TaskActions } from '../task/TaskActions';
import { Comments, Attachments } from '../task/Comments';
import { ExtDecision } from '../task/ExtDecision';
import { Icon } from '../Shell';

type Tab = 'comments' | 'files' | 'history';

/** Side sheet: view and act on a task without leaving the board. */
export function TaskDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<TaskBundle | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('comments');
  const load = useCallback(() => { getTaskBundle(id).then(setData).catch(() => setData(null)); }, [id]);
  useEffect(() => { setData(undefined); load(); }, [load]);
  useOnChanged(load);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const task = data?.task;
  const pendingExt = data?.extensions.filter((e) => e.status === 'pending') ?? [];

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="anim-fade absolute inset-0 bg-brand-900/30" onClick={onClose} />
      <aside role="dialog" aria-modal aria-label={task?.title ?? t('board.loadingTask')}
        className="anim-sheet-end absolute inset-y-0 end-0 flex w-full max-w-[640px] flex-col bg-brand-50 shadow-lift sm:rounded-s-2xl">
        <header className="flex items-center gap-2 border-b border-brand-200 bg-white px-5 py-3 sm:rounded-ss-2xl">
          {task && <span className="font-mono text-xs text-ink-500">{task.code}</span>}
          {task && <StatusBadge status={task.status} />}
          {task && <PriorityBadge priority={task.priority} />}
          <div className="ms-auto flex items-center gap-1">
            {task && <Link href={`/tasks/${task.id}`} className="btn-ghost btn-sm"><Icon name="external" className="h-4 w-4" />{t('board.openFull')}</Link>}
            <button className="btn-ghost btn-sm" onClick={onClose} aria-label={t('board.close')}><Icon name="x" className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin">
          {data === undefined && (
            <div className="space-y-3 p-5" aria-busy>
              <div className="skeleton h-7 w-3/4" /><div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-24 w-full rounded-2xl" /><div className="skeleton h-40 w-full rounded-2xl" />
            </div>
          )}
          {data === null && <p className="p-6 text-sm text-ink-500">{t('err.task_not_found')}</p>}
          {data && task && (
            <div className="space-y-4 p-5">
              <div>
                <h2 className="text-lg font-bold leading-snug text-ink-900">{task.title}</h2>
                {task.description && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{task.description}</p>}
              </div>

              <TaskActions task={task} perms={data.perms} people={data.people} projects={data.projects} departments={data.departments} minDate={data.today} />

              {pendingExt.map((e) => (
                <div key={e.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink-900">{t('ext.request')}</span><ExtBadge status={e.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-ink-500">{t('ext.original')}</div><div className="font-semibold">{fmtDate(e.original_deadline)}</div></div>
                    <div><div className="text-ink-500">{t('ext.currentDeadline')}</div><div className="font-semibold">{fmtDate(e.previous_deadline)}</div></div>
                    <div><div className="text-ink-500">{t('ext.requested')}</div><div className="font-semibold">{fmtDate(e.requested_deadline)} <span className="text-amber-700">{t('ext.daysExtra', { n: daysBetween(e.previous_deadline, e.requested_deadline) })}</span></div></div>
                  </div>
                  <p className="mt-2 text-sm text-ink-800"><b>{t('ext.reason')}:</b> {e.reason}</p>
                  <div className="mt-3"><ExtDecision id={e.id} requested={e.requested_deadline} canDecide={e.canDecide} canWithdraw={e.canWithdraw} /></div>
                </div>
              ))}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-brand-200 bg-white p-4 text-sm">
                <div className="col-span-2 sm:col-span-1"><dt className="text-xs text-ink-500">{t('tasks.assignee')}</dt><dd className="mt-1"><Person name={task.assignee_name} sub={task.department_name} /></dd></div>
                <div><dt className="text-xs text-ink-500">{t('tasks.acceptance')}</dt><dd className="mt-1 font-medium">{t(`acceptance.${task.acceptance}`)}</dd></div>
                <div><dt className="text-xs text-ink-500">{t('tasks.currentDeadline')}</dt><dd className="mt-1"><DeadlineText date={task.current_deadline} state={task.deadline_state} extended={task.deadline_extended} /></dd></div>
                <div><dt className="text-xs text-ink-500">{t('tasks.originalDeadline')}</dt><dd className="mt-1">{fmtDate(task.original_deadline)}</dd></div>
                <div><dt className="text-xs text-ink-500">{t('tasks.project')}</dt><dd className="mt-1">{task.project_name ?? '—'}</dd></div>
                <div><dt className="text-xs text-ink-500">{t('tasks.progress')}</dt><dd className="mt-1"><ProgressBar value={task.progress} /></dd></div>
                <div><dt className="text-xs text-ink-500">{t('tasks.createdBy')}</dt><dd className="mt-1">{task.creator_name}</dd></div>
                <div><dt className="text-xs text-ink-500">{t('tasks.assignedAt')}</dt><dd className="mt-1">{fmtDateTime(task.assigned_at)}</dd></div>
              </dl>

              <div>
                <div className="mb-3 flex gap-1 rounded-xl bg-brand-100 p-1">
                  {(['comments', 'files', 'history'] as Tab[]).map((k) => (
                    <button key={k} onClick={() => setTab(k)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${tab === k ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}>
                      {k === 'comments' ? `${t('tasks.comments')} (${data.comments.length})` : k === 'files' ? `${t('tasks.attachments')} (${data.attachments.length})` : t('tasks.history')}
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border border-brand-200 bg-white p-4">
                  {tab === 'comments' && <Comments taskId={task.id} items={data.comments} canWrite />}
                  {tab === 'files' && <Attachments taskId={task.id} items={data.attachments} canUpload={!['completed', 'cancelled'].includes(task.status)} />}
                  {tab === 'history' && (
                    <div className="space-y-5">
                      {data.assignments.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-xs font-bold text-ink-600">{t('tasks.handovers')}</h4>
                          <ul className="space-y-1.5 text-xs">
                            {data.assignments.map((a) => (
                              <li key={a.id} className="flex flex-wrap items-center gap-x-2 rounded-lg bg-brand-50 px-2.5 py-1.5">
                                <span className="font-semibold">{a.from_name ? `${a.from_name} ← ` : ''}{a.to_name}</span>
                                <span className="text-ink-500">{t(`tasks.response_${a.response}`)} · {a.by_name} · {fmtDateTime(a.created_at)}</span>
                                {a.response_reason && <span className="w-full text-rose-700">{a.response_reason}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Timeline items={data.activity} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
