import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { fetchLookups, sp, type SearchParams } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { Avatar, Empty, PageHeader } from '@/components/ui';
import { ACTIVE_STATUSES, STATUS_ORDER } from '@/lib/constants';
import type { TaskRow } from '@/lib/types';
import { workloadLevel } from '@/lib/workload';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const s = await requireSession();
  if (!s.can('team.manage') && s.profile.role !== 'team_leader') return null;
  const params = await searchParams;
  const f = { department: sp(params, 'department'), q: sp(params, 'q'), project: sp(params, 'project'), status: sp(params, 'status') };
  const supabase = await createClient();
  const lk = await fetchLookups();
  let tq = supabase.from('task_overview').select('id,status,assignee_id,is_overdue,project_id').not('assignee_id', 'is', null);
  if (f.project) tq = tq.eq('project_id', f.project);
  if (f.status) tq = tq.eq('status', f.status);
  const { data } = await tq.limit(5000);
  const tasks = (data ?? []) as Pick<TaskRow, 'id' | 'status' | 'assignee_id' | 'is_overdue'>[];

  let people = lk.people.filter((p) => p.is_active);
  if (s.profile.role !== 'admin' && !s.can('team.manage')) people = people.filter((p) => p.department_id === s.profile.department_id);
  if (f.department) people = people.filter((p) => (f.department === 'none' ? !p.department_id : p.department_id === f.department));
  if (f.q) people = people.filter((p) => p.full_name.includes(f.q));

  const cards = people.map((p) => {
    const mine = tasks.filter((x) => x.assignee_id === p.id);
    const c = (st: string) => mine.filter((x) => x.status === st).length;
    const active = mine.filter((x) => ACTIVE_STATUSES.includes(x.status)).length;
    return { p, total: mine.length, pending: c('pending_acceptance'), progress: c('in_progress') + c('accepted') + c('changes_requested') + c('on_hold'),
      review: c('submitted'), done: c('completed'), overdue: mine.filter((x) => x.is_overdue).length, active, level: workloadLevel(active, p.max_active_tasks) };
  }).sort((a, b) => b.level.pct - a.level.pct);
  const deptName = (id: string | null) => lk.departments.find((d) => d.id === id)?.name;

  return (
    <div>
      <PageHeader title={t('team.title')} subtitle={t('team.subtitle')} />
      <form className="card mb-4 flex flex-wrap items-center gap-2 p-3" method="get">
        <input name="q" defaultValue={f.q} className="input w-full py-1.5 sm:w-56" placeholder={t('common.search')} />
        <select name="department" defaultValue={f.department} className="input w-auto py-1.5">
          <option value="">{t('tasks.department')}: {t('common.all')}</option><option value="none">{t('common.noDepartment')}</option>
          {lk.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select name="project" defaultValue={f.project} className="input w-auto py-1.5">
          <option value="">{t('tasks.project')}: {t('common.all')}</option>{lk.projects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select name="status" defaultValue={f.status} className="input w-auto py-1.5">
          <option value="">{t('tasks.status')}: {t('common.all')}</option>{STATUS_ORDER.map((st) => <option key={st} value={st}>{t(`status.${st}`)}</option>)}
        </select>
        <button className="btn-primary btn-sm">{t('common.apply')}</button>
        <Link href="/team" className="btn-ghost btn-sm">{t('common.reset')}</Link>
      </form>
      {!cards.length ? <div className="card"><Empty /></div> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ p, level, ...c }) => (
            <Link key={p.id} href={`/team/${p.id}`} className="card block p-4 transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-center gap-3">
                <Avatar name={p.full_name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink-900">{p.full_name}</div>
                  <div className="truncate text-xs text-ink-500">{[p.job_title, deptName(p.department_id), t(`role.${p.role}`)].filter(Boolean).join(' · ')}</div>
                </div>
                {!p.user_id && <span className="badge bg-ink-50 text-ink-500 ring-ink-200">{t('team.noLogin')}</span>}
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs">
                  <span className={`font-semibold ${level.text}`}>{t('team.workload')}: {t(`team.${level.key}`)}</span>
                  <span className="text-ink-500">{t('team.activeOf', { a: c.active, m: p.max_active_tasks })}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className={`h-full rounded-full ${level.cls}`} style={{ width: `${Math.min(100, level.pct)}%` }} /></div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                {([['assigned', c.total], ['pendingAcceptance', c.pending], ['inProgress', c.progress], ['underReview', c.review], ['completed', c.done], ['overdue', c.overdue]] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-ink-50 px-1 py-2">
                    <dd className={`text-base font-bold tabular-nums ${k === 'overdue' && v ? 'text-red-600' : 'text-ink-900'}`}>{v}</dd>
                    <dt className="mt-0.5 text-[10px] leading-tight text-ink-500">{t(`team.${k}`)}</dt>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
