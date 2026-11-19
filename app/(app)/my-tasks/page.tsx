import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { fetchLookups, fetchTasks, filterFromParams, sp, type SearchParams } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { PageHeader } from '@/components/ui';
import { TaskFilters, ViewToggle } from '@/components/TaskFilters';
import { Kanban, TaskTable } from '@/components/TaskTable';

export const dynamic = 'force-dynamic';

const TABS: Record<string, string[]> = {
  pending: ['pending_acceptance'],
  active: ['accepted', 'in_progress', 'on_hold', 'changes_requested'],
  review: ['submitted'],
  done: ['completed', 'cancelled'],
  all: [],
};

export default async function MyTasks({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const s = await requireSession();
  const params = await searchParams;
  const tab = sp(params, 'tab') || 'active';
  const [all, lk] = await Promise.all([fetchTasks(filterFromParams(params), { assigneeId: s.profile.id }), fetchLookups()]);
  const counts = Object.fromEntries(Object.entries(TABS).map(([k, st]) => [k, st.length ? all.filter((x) => st.includes(x.status)).length : all.length]));
  const tasks = TABS[tab]?.length ? all.filter((x) => TABS[tab].includes(x.status)) : all;
  const view = sp(params, 'view') || 'table';
  return (
    <div>
      <PageHeader title={t('tasks.myTitle')} actions={<ViewToggle />} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ink-200 scroll-thin">
        {Object.keys(TABS).map((k) => (
          <Link key={k} href={`/my-tasks?tab=${k}`} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>
            {t(`tasks.tabs.${k}`)} <span className={`ms-1 rounded-full px-1.5 text-xs ${k === 'pending' && counts[k] ? 'bg-amber-500 text-white' : 'bg-ink-100 text-ink-600'}`}>{counts[k]}</span>
          </Link>
        ))}
      </div>
      <TaskFilters hide={['assignee', 'status', 'department']} people={[]}
        projects={lk.projects.map((p) => ({ id: p.id, name: p.name }))} departments={[]} />
      {view === 'kanban' ? <Kanban tasks={tasks} /> : <TaskTable tasks={tasks} hideAssignee />}
    </div>
  );
}
