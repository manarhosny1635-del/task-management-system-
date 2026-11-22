import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { fetchLookups, fetchTasks, filterFromParams, sp, type SearchParams } from '@/lib/queries';
import { managesTask } from '@/lib/scope';
import { t } from '@/lib/i18n/t';
import { PageHeader } from '@/components/ui';
import { TaskFilters, ViewToggle } from '@/components/TaskFilters';
import { TaskTable } from '@/components/TaskTable';
import { Board, type BoardTask } from '@/components/board/Board';
import { ExportButtons } from '@/components/ExportButton';
import { taskExportRows } from '@/lib/exportRows';
import { Icon } from '@/components/Shell';
import type { QuickAddData } from '@/components/QuickAdd';

export const dynamic = 'force-dynamic';

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const s = await requireSession();
  const params = await searchParams;
  const manager = s.isManager || s.can('tasks.view_all');
  const mine = !manager || sp(params, 'mine') === '1';
  const [tasks, lk] = await Promise.all([fetchTasks(filterFromParams(params), mine ? { assigneeId: s.profile.id } : undefined), fetchLookups()]);
  const view = sp(params, 'view') || 'board';

  const deptName = new Map(lk.departments.map((d) => [d.id, d.name]));
  const assignable = lk.people.filter((p) => p.is_active && (s.profile.role === 'admin' || p.department_id === s.profile.department_id || p.id === s.profile.id));
  const quickAdd: QuickAddData | null = s.can('tasks.create') ? {
    people: assignable.map((p) => ({ id: p.id, name: p.full_name, dept: p.department_id ? deptName.get(p.department_id) : undefined })),
    projects: lk.projects.filter((p) => p.status === 'active').map((p) => ({ id: p.id, name: p.name })),
  } : null;

  const boardTasks: BoardTask[] = tasks.filter((x) => x.status !== 'cancelled').map((x) => {
    const isOwner = x.assignee_id === s.profile.id;
    const canManage = s.can('tasks.create') && managesTask(s, x);
    return { ...x, perms: { isOwner, canManage, canReview: canManage && s.can('tasks.review') && !isOwner } };
  });
  return (
    <div>
      <PageHeader title={t('board.title')} subtitle={view === 'board' ? t('board.subtitle') : undefined} actions={<>
        <ViewToggle mineToggle={manager} />
        {view === 'list' && <ExportButtons filename="tasks" sheets={[{ name: t('tasks.title'), rows: taskExportRows(tasks) }]} />}
        {s.can('tasks.create') && <Link href="/assign" className="btn-secondary hidden sm:inline-flex"><Icon name="list" className="h-4 w-4" />{t('board.bulk')}</Link>}
      </>} />
      <TaskFilters showSort hide={mine ? ['assignee'] : []}
        people={lk.people.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.full_name }))}
        projects={lk.projects.map((p) => ({ id: p.id, name: p.name }))} departments={lk.departments.map((d) => ({ id: d.id, name: d.name }))} />
      {view === 'list'
        ? <TaskTable tasks={tasks} hideAssignee={mine} />
        : <Board tasks={boardTasks} people={assignable.map((p) => ({ id: p.id, name: p.full_name }))} sort={sp(params, 'sort') || 'deadline'} quickAdd={quickAdd} profileId={s.profile.id} />}
    </div>
  );
}
