import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { fetchLookups } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { fmtDate, fmtDateTime, todayISO, daysBetween } from '@/lib/format';
import { Card, DeadlineText, ExtBadge, Person, PriorityBadge, ProgressBar, StatusBadge } from '@/components/ui';
import { Timeline } from '@/components/Activity';
import { TaskActions } from '@/components/task/TaskActions';
import { Comments, Attachments } from '@/components/task/Comments';
import { ExtDecision } from '@/components/task/ExtDecision';
import { managesTask, canDecideExtension } from '@/lib/scope';
import type { ActivityRow, ExtensionRow, TaskRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{children}</dd>
    </div>
  );
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const supabase = await createClient();
  const { data: task } = await supabase.from('task_overview').select('*').eq('id', id).maybeSingle<TaskRow>();
  if (!task) notFound();

  const [assign, exts, comments, files, acts, lk] = await Promise.all([
    supabase.from('assignment_overview').select('*').eq('task_id', id).order('created_at'),
    supabase.from('extension_overview').select('*').eq('task_id', id).order('created_at', { ascending: false }),
    supabase.from('task_comments').select('*').eq('task_id', id).order('created_at', { ascending: false }),
    supabase.from('attachments').select('*').eq('task_id', id).order('created_at', { ascending: false }),
    supabase.from('activity_overview').select('*').eq('task_id', id).order('id', { ascending: true }),
    fetchLookups(),
  ]);
  const names = new Map(lk.people.map((p) => [p.id, p.full_name]));
  const isOwner = task.assignee_id === s.profile.id;
  const canManage = s.can('tasks.create') && managesTask(s, task);
  const perms = { isOwner, canManage, canReview: canManage && s.can('tasks.review') && !isOwner, canChangeDeadline: canManage && s.can('extensions.approve') };
  const locked = ['completed', 'cancelled'].includes(task.status);
  const assignable = lk.people.filter((p) => p.is_active && (s.profile.role === 'admin' || p.department_id === s.profile.department_id || p.id === s.profile.id))
    .map((p) => ({ id: p.id, name: p.full_name }));
  const extensions = (exts.data ?? []) as ExtensionRow[];

  return (
    <div>
      <div className="mb-4 text-sm"><Link href={isOwner ? '/my-tasks' : '/tasks'} className="text-brand-600 hover:underline">← {t('common.back')}</Link></div>
      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-ink-500">{task.code}</span>
              <StatusBadge status={task.status} /><PriorityBadge priority={task.priority} />
              {task.is_overdue && <span className="badge bg-red-600 text-white ring-red-600">{t('deadline.overdue')}</span>}
              {task.source === 'import' && <span className="badge bg-ink-50 text-ink-600 ring-ink-200">{t('tasks.imported')}</span>}
            </div>
            <h1 className="mt-2 text-xl font-bold text-ink-900">{task.title}</h1>
            {task.description && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-ink-700">{task.description}</p>}
          </div>
          <div className="w-full sm:w-auto">
            <TaskActions task={task} perms={perms} people={assignable} minDate={todayISO()}
              projects={lk.projects.map((p) => ({ id: p.id, name: p.name }))} departments={lk.departments.map((d) => ({ id: d.id, name: d.name }))} />
          </div>
        </div>
        {locked && <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{t('tasks.lockedNote')}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {extensions.some((e) => e.status === 'pending') && (
            <Card title={t('ext.title')} className="border-amber-300">
              {extensions.filter((e) => e.status === 'pending').map((e) => (
                <div key={e.id} className="space-y-3">
                  <div className="grid gap-3 text-sm sm:grid-cols-4">
                    <div><div className="text-xs text-ink-500">{t('ext.original')}</div>{fmtDate(task.original_deadline)}</div>
                    <div><div className="text-xs text-ink-500">{t('ext.currentDeadline')}</div>{fmtDate(e.previous_deadline)}</div>
                    <div><div className="text-xs text-ink-500">{t('ext.requested')}</div><b>{fmtDate(e.requested_deadline)}</b> <span className="text-xs text-amber-700">{t('ext.daysExtra', { n: daysBetween(e.previous_deadline, e.requested_deadline) })}</span></div>
                    <div><div className="text-xs text-ink-500">{t('ext.progressAt')}</div>{e.progress_at_request ?? 0}%</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 text-sm"><b>{t('ext.reason')}:</b> {e.reason}{e.notes && <><br /><b>{t('ext.notes')}:</b> {e.notes}</>}</div>
                  <div className="text-xs text-ink-500">{e.requester_name} · {fmtDateTime(e.created_at)} · {t('ext.previous')}: {e.previous_requests}</div>
                  <ExtDecision id={e.id} requested={e.requested_deadline} canDecide={canDecideExtension(s, e, task.created_by)} canWithdraw={e.requested_by === s.profile.id} />
                </div>
              ))}
            </Card>
          )}
          <Card title={t('tasks.comments')}>
            <Comments taskId={task.id} canWrite
              items={(comments.data ?? []).map((c) => ({ id: c.id, kind: c.kind, body: c.body, created_at: c.created_at, author: names.get(c.author_id) ?? '' }))} />
          </Card>
          <Card title={t('tasks.history')}>
            <Timeline items={(acts.data ?? []) as ActivityRow[]} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={t('common.details')} bodyClass="px-4 py-1">
            <dl className="divide-y divide-ink-100">
              <Field label={t('tasks.assignee')}><Person name={task.assignee_name} />{!task.assignee_id && task.suggested_assignee_name && <div className="mt-1 text-xs text-ink-500">{t('tasks.suggested')} {task.suggested_assignee_name}</div>}</Field>
              <Field label={t('tasks.acceptance')}>{t(`acceptance.${task.acceptance}`)}{task.accepted_at && <span className="text-xs text-ink-500"> · {fmtDateTime(task.accepted_at)}</span>}</Field>
              <Field label={t('tasks.progress')}><ProgressBar value={task.progress} /></Field>
              <Field label={t('tasks.originalDeadline')}>{fmtDate(task.original_deadline)}</Field>
              <Field label={t('tasks.currentDeadline')}><DeadlineText date={task.current_deadline} state={task.deadline_state} extended={task.deadline_extended} /> <span className="text-xs text-ink-500">· {t(`deadline.${task.deadline_state}`)}</span></Field>
              <Field label={t('tasks.startDate')}>{fmtDate(task.start_date)}</Field>
              <Field label={t('tasks.project')}>{task.project_name ?? '—'}</Field>
              <Field label={t('tasks.department')}>{task.department_name ?? '—'}</Field>
              <Field label={t('tasks.createdBy')}>{task.creator_name} <span className="text-xs text-ink-500">· {fmtDateTime(task.created_at)}</span></Field>
              <Field label={t('tasks.assignedAt')}>{fmtDateTime(task.assigned_at)}</Field>
              <Field label={t('tasks.completedAt')}>{fmtDateTime(task.completed_at)}</Field>
              <Field label={t('tasks.status')}>{task.requires_review ? t('tasks.requiresReview') : t('tasks.noReview')}</Field>
            </dl>
          </Card>

          <Card title={t('tasks.attachments')}>
            <Attachments taskId={task.id} canUpload={!locked}
              items={(files.data ?? []).map((a) => ({ id: a.id, file_name: a.file_name, storage_path: a.storage_path, size_bytes: a.size_bytes, created_at: a.created_at, uploader: names.get(a.uploaded_by) ?? '', ext: !!a.extension_request_id }))} />
          </Card>

          <Card title={t('tasks.handovers')}>
            <ol className="space-y-3">
              {(assign.data ?? []).map((a) => (
                <li key={a.id} className="rounded-lg border border-ink-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.from_name ? `${a.from_name} ← ` : ''}{a.to_name}</span>
                    <span className={`badge ${a.response === 'accepted' ? 'bg-green-50 text-green-700 ring-green-200' : a.response === 'rejected' ? 'bg-red-50 text-red-700 ring-red-200' : a.response === 'pending' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-ink-50 text-ink-500 ring-ink-200'}`}>{t(`tasks.response_${a.response}`)}</span>
                  </div>
                  <div className="mt-1 text-xs text-ink-500">{t('tasks.performedBy')}: {a.by_name} · {fmtDateTime(a.created_at)}</div>
                  {a.note && <div className="mt-1 text-xs text-ink-600">{a.note}</div>}
                  {a.response_reason && <div className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{t('common.reason')}: {a.response_reason}</div>}
                </li>
              ))}
              {!(assign.data ?? []).length && <li className="text-sm text-ink-500">—</li>}
            </ol>
          </Card>

          <Card title={t('tasks.extensions')}>
            {!extensions.length ? <p className="text-sm text-ink-500">—</p> : (
              <ul className="space-y-3">
                {extensions.map((e) => (
                  <li key={e.id} className="rounded-lg border border-ink-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2"><span>{fmtDate(e.previous_deadline)} ← <b>{fmtDate(e.requested_deadline)}</b></span><ExtBadge status={e.status} /></div>
                    <div className="mt-1 text-xs text-ink-600">{e.reason}</div>
                    {e.decider_name && <div className="mt-1 text-xs text-ink-500">{t('ext.decidedBy')}: {e.decider_name} · {fmtDateTime(e.decided_at)}</div>}
                    {e.decision_reason && <div className="mt-1 text-xs text-ink-600">{t('ext.decision')}: {e.decision_reason}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
