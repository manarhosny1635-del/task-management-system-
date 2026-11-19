import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { fetchLookups, sp, type SearchParams } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { fmtDate, fmtDateTime, daysBetween } from '@/lib/format';
import { Empty, ExtBadge, PageHeader } from '@/components/ui';
import { ExtDecision } from '@/components/task/ExtDecision';
import { canDecideExtension } from '@/lib/scope';
import type { ExtensionRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ExtensionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const s = await requireSession();
  const params = await searchParams;
  const f = { status: sp(params, 'status'), employee: sp(params, 'employee'), project: sp(params, 'project'), from: sp(params, 'from'), to: sp(params, 'to') };
  const supabase = await createClient();
  let q = supabase.from('extension_overview').select('*');
  if (f.status) q = q.eq('status', f.status);
  if (f.employee) q = q.eq('requested_by', f.employee);
  if (f.project) q = q.eq('project_id', f.project);
  if (f.from) q = q.gte('created_at', f.from);
  if (f.to) q = q.lte('created_at', f.to + 'T23:59:59');
  const [{ data }, lk, { data: creators }] = await Promise.all([
    q.order('status', { ascending: true }).order('created_at', { ascending: false }).limit(500),
    fetchLookups(),
    supabase.from('tasks').select('id,created_by'),
  ]);
  const rows = (data ?? []) as ExtensionRow[];
  const createdBy = new Map((creators ?? []).map((c) => [c.id, c.created_by]));
  const counts = { pending: rows.filter((r) => r.status === 'pending').length };

  return (
    <div>
      <PageHeader title={t('ext.title')} subtitle={t('ext.subtitle')} />
      <div className="mb-3 flex flex-wrap gap-1">
        {['', 'pending', 'approved', 'rejected'].map((st) => {
          const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
          if (st) p.set('status', st); else p.delete('status');
          return <Link key={st} href={`/extensions?${p}`} className={`rounded-full px-3 py-1 text-sm ${f.status === st ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'}`}>
            {st ? t(`extStatus.${st}`) : t('common.all')}{st === 'pending' && counts.pending ? ` (${counts.pending})` : ''}</Link>;
        })}
      </div>
      <form method="get" className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        {f.status && <input type="hidden" name="status" value={f.status} />}
        <select name="employee" defaultValue={f.employee} className="input w-auto py-1.5">
          <option value="">{t('ext.requestedBy')}: {t('common.all')}</option>{lk.people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <select name="project" defaultValue={f.project} className="input w-auto py-1.5">
          <option value="">{t('tasks.project')}: {t('common.all')}</option>{lk.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-ink-600">{t('ext.requestDate')} {t('common.from')}<input type="date" name="from" defaultValue={f.from} className="input w-auto py-1.5" /></label>
        <label className="flex items-center gap-1 text-xs text-ink-600">{t('common.to')}<input type="date" name="to" defaultValue={f.to} className="input w-auto py-1.5" /></label>
        <button className="btn-primary btn-sm">{t('common.apply')}</button>
        <Link href="/extensions" className="btn-ghost btn-sm">{t('common.reset')}</Link>
      </form>

      {!rows.length ? <div className="card"><Empty /></div> : (
        <div className="space-y-3">
          {rows.map((e) => (
            <div key={e.id} className={`card p-4 ${e.status === 'pending' ? 'border-amber-300' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ExtBadge status={e.status} />
                    <Link href={`/tasks/${e.task_id}`} className="font-semibold text-ink-900 hover:text-brand-700"><span className="font-mono text-xs text-ink-500">{e.task_code}</span> {e.task_title}</Link>
                  </div>
                  <div className="mt-1 text-xs text-ink-500">{e.requester_name} · {fmtDateTime(e.created_at)}{e.project_name ? ` · ${e.project_name}` : ''}</div>
                </div>
                <ExtDecision id={e.id} requested={e.requested_deadline} canDecide={canDecideExtension(s, e, createdBy.get(e.task_id))}
                  canWithdraw={e.status === 'pending' && e.requested_by === s.profile.id} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <div><dt className="text-xs text-ink-500">{t('ext.original')}</dt><dd>{fmtDate(e.original_deadline)}</dd></div>
                <div><dt className="text-xs text-ink-500">{t('ext.currentDeadline')}</dt><dd>{fmtDate(e.previous_deadline)}</dd></div>
                <div><dt className="text-xs text-ink-500">{t('ext.requested')}</dt><dd className="font-semibold">{fmtDate(e.requested_deadline)} <span className="text-xs font-normal text-amber-700">{t('ext.daysExtra', { n: daysBetween(e.previous_deadline, e.requested_deadline) })}</span></dd></div>
                <div><dt className="text-xs text-ink-500">{t('ext.progressAt')}</dt><dd>{e.progress_at_request ?? 0}% <span className="text-xs text-ink-500">({t('tasks.progress')}: {e.task_progress}%)</span></dd></div>
                <div><dt className="text-xs text-ink-500">{t('ext.previous')}</dt><dd>{e.previous_requests}</dd></div>
              </dl>
              <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-800"><b>{t('ext.reason')}:</b> {e.reason}{e.notes && <> — {e.notes}</>}</p>
              {e.decided_at && e.status !== 'pending' && (
                <p className="mt-2 text-xs text-ink-600">{t('ext.decidedBy')}: {e.decider_name ?? t('activity.system')} · {fmtDateTime(e.decided_at)}{e.decision_reason ? ` — ${e.decision_reason}` : ''}</p>
              )}
              {e.status === 'pending' && e.assignee_id === s.profile.id && s.can('extensions.approve') && <p className="mt-2 text-xs text-ink-500">{t('ext.cannotOwn')}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
