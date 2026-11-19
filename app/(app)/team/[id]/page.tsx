import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { fetchTasks, filterFromParams, fetchLookups, type SearchParams } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { Avatar, Kpi } from '@/components/ui';
import { TaskTable } from '@/components/TaskTable';
import { TaskFilters } from '@/components/TaskFilters';
import { ACTIVE_STATUSES } from '@/lib/constants';
import { workloadLevel } from '@/lib/workload';

export const dynamic = 'force-dynamic';

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const s = await requireSession();
  const supabase = await createClient();
  const { data: p } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!p) notFound();
  const [tasks, lk] = await Promise.all([fetchTasks(filterFromParams(await searchParams), { assigneeId: id }), fetchLookups()]);
  const all = await fetchTasks({}, { assigneeId: id });
  const c = (st: string[]) => all.filter((x) => st.includes(x.status)).length;
  const active = c(ACTIVE_STATUSES);
  const level = workloadLevel(active, p.max_active_tasks);
  return (
    <div>
      <div className="mb-4 text-sm"><Link href="/team" className="text-brand-600 hover:underline">← {t('nav.team')}</Link></div>
      <div className="card mb-4 flex flex-wrap items-center gap-4 p-5">
        <Avatar name={p.full_name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-ink-900">{p.full_name}</h1>
          <p className="text-sm text-ink-500">{[p.job_title, lk.departments.find((d) => d.id === p.department_id)?.name, t(`role.${p.role}`)].filter(Boolean).join(' · ')}</p>
          <p className={`mt-1 text-sm font-medium ${level.text}`}>{t('team.workload')}: {t(`team.${level.key}`)} — {t('team.activeOf', { a: active, m: p.max_active_tasks })}</p>
        </div>
        {s.can('tasks.create') && <Link href={`/assign?employee=${p.id}`} className="btn-primary">+ {t('tasks.newTask')}</Link>}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label={t('team.assigned')} value={all.length} />
        <Kpi label={t('team.pendingAcceptance')} value={c(['pending_acceptance'])} tone="warn" />
        <Kpi label={t('team.inProgress')} value={c(['accepted', 'in_progress', 'on_hold', 'changes_requested'])} tone="brand" />
        <Kpi label={t('team.underReview')} value={c(['submitted'])} />
        <Kpi label={t('team.completed')} value={c(['completed'])} tone="good" />
        <Kpi label={t('team.overdue')} value={all.filter((x) => x.is_overdue).length} tone="danger" />
      </div>
      <h2 className="mb-3 text-base font-semibold">{t('team.allTasksOf', { name: p.full_name })}</h2>
      <TaskFilters hide={['assignee']} people={[]} projects={lk.projects.map((x) => ({ id: x.id, name: x.name }))} departments={lk.departments.map((d) => ({ id: d.id, name: d.name }))} />
      <TaskTable tasks={tasks} hideAssignee />
    </div>
  );
}
