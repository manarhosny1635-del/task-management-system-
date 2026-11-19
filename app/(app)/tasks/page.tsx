import { requireSession } from '@/lib/session';
import { fetchLookups, fetchTasks, filterFromParams, sp, type SearchParams } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { PageHeader } from '@/components/ui';
import { TaskFilters, ViewToggle } from '@/components/TaskFilters';
import { Kanban, TaskTable } from '@/components/TaskTable';
import { ExportButtons } from '@/components/ExportButton';
import { taskExportRows } from '@/lib/exportRows';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const s = await requireSession();
  const params = await searchParams;
  const [tasks, lk] = await Promise.all([fetchTasks(filterFromParams(params)), fetchLookups()]);
  const view = sp(params, 'view') || 'table';
  return (
    <div>
      <PageHeader title={t('tasks.title')} actions={<>
        <ViewToggle />
        <ExportButtons filename="tasks" sheets={[{ name: t('tasks.title'), rows: taskExportRows(tasks) }]} />
        {s.can('tasks.create') && <Link href="/assign" className="btn-primary">+ {t('tasks.newTask')}</Link>}
      </>} />
      <TaskFilters people={lk.people.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.full_name }))}
        projects={lk.projects.map((p) => ({ id: p.id, name: p.name }))} departments={lk.departments.map((d) => ({ id: d.id, name: d.name }))} />
      {view === 'kanban' ? <Kanban tasks={tasks} /> : <TaskTable tasks={tasks} />}
    </div>
  );
}
