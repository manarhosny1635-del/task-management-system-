import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/t';
import { Card, Kpi, PageHeader, Empty } from '@/components/ui';
import { HBar, StackedHBar, SplitBar } from '@/components/Charts';
import { Timeline } from '@/components/Activity';
import { STATUS_COLOR, STATUS_ORDER } from '@/lib/constants';
import type { ActivityRow, TaskRow, TaskStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

function countBy<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  rows.forEach((r) => { const k = key(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export default async function Dashboard() {
  const s = await requireSession();
  const supabase = await createClient();
  if (s.profile.role === 'admin') await supabase.rpc('run_deadline_checks');

  const [{ data: taskData }, { data: actData }, { data: extData }] = await Promise.all([
    supabase.from('task_overview').select('id,status,assignee_id,assignee_name,project_name,department_name,is_overdue,created_by,requires_review').limit(5000),
    supabase.from('activity_overview').select('*').not('task_id', 'is', null).order('id', { ascending: false }).limit(12),
    supabase.from('extension_requests').select('id,requested_by,status').eq('status', 'pending'),
  ]);
  const tasks = (taskData ?? []) as Pick<TaskRow, 'id' | 'status' | 'assignee_id' | 'assignee_name' | 'project_name' | 'department_name' | 'is_overdue' | 'created_by' | 'requires_review'>[];
  const live = tasks.filter((x) => x.status !== 'cancelled');
  const by = (st: TaskStatus) => live.filter((x) => x.status === st).length;
  const overdue = live.filter((x) => x.is_overdue).length;
  const pendingExt = (extData ?? []).filter((e) => e.requested_by !== s.profile.id).length;
  const completed = by('completed');
  const isMgr = s.isManager;

  const statusData = STATUS_ORDER.filter((st) => st !== 'cancelled').map((st) => ({ name: t(`status.${st}`), value: by(st), color: STATUS_COLOR[st] })).filter((d) => d.value);
  const employees = new Map<string, { name: string; a: number; b: number; overdue: number }>();
  live.filter((x) => x.assignee_name && x.status !== 'declined').forEach((x) => {
    const e = employees.get(x.assignee_id!) ?? { name: x.assignee_name!, a: 0, b: 0, overdue: 0 };
    if (x.status === 'completed') e.a++; else e.b++;
    if (x.is_overdue) e.overdue++;
    employees.set(x.assignee_id!, e);
  });
  const empRows = [...employees.values()].sort((x, y) => y.a + y.b - (x.a + x.b));
  const overdueRows = empRows.filter((e) => e.overdue).map((e) => ({ name: e.name, value: e.overdue, color: '#dc2626' })).sort((x, y) => y.value - x.value);
  const projRows = countBy(live, (x) => x.project_name ?? t('common.noProject')).slice(0, 15);
  const deptRows = countBy(live, (x) => x.department_name ?? t('common.noDepartment'));

  const myId = s.profile.id;
  const actions = isMgr ? [
    { label: t('dashboard.actReview'), n: live.filter((x) => x.status === 'submitted' && x.assignee_id !== myId).length, href: '/tasks?status=submitted' },
    { label: t('dashboard.actExt'), n: s.can('extensions.approve') ? pendingExt : 0, href: '/extensions?status=pending' },
    { label: t('dashboard.actDeclined'), n: by('declined'), href: '/tasks?status=declined' },
    { label: t('dashboard.actUnassigned'), n: by('new'), href: '/tasks?status=new' },
    { label: t('dashboard.overdue'), n: overdue, href: '/tasks?overdue=yes' },
  ] : [
    { label: t('dashboard.actAccept'), n: live.filter((x) => x.status === 'pending_acceptance' && x.assignee_id === myId).length, href: '/my-tasks?tab=pending' },
    { label: t('dashboard.actChanges'), n: live.filter((x) => x.status === 'changes_requested' && x.assignee_id === myId).length, href: '/my-tasks?tab=active' },
    { label: t('dashboard.overdue'), n: live.filter((x) => x.is_overdue && x.assignee_id === myId).length, href: '/my-tasks?tab=active' },
  ];
  const base = isMgr ? '/tasks' : '/my-tasks';

  return (
    <div>
      <PageHeader title={isMgr ? t('dashboard.title') : t('dashboard.myOverview')} subtitle={t('dashboard.subtitle')}
        actions={s.can('tasks.create') && <Link href="/assign" className="btn-primary">+ {t('tasks.newTask')}</Link>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Kpi label={t('dashboard.total')} value={live.length} href={base} />
        <Kpi label={t('dashboard.unassigned')} value={by('new') + by('declined')} href={`${base}?status=new`} />
        <Kpi label={t('dashboard.awaiting')} value={by('pending_acceptance')} href={`${base}?status=pending_acceptance`} tone="warn" />
        <Kpi label={t('dashboard.inProgress')} value={by('in_progress') + by('accepted') + by('changes_requested') + by('on_hold')} href={`${base}?status=in_progress`} tone="brand" />
        <Kpi label={t('dashboard.review')} value={by('submitted')} href={`${base}?status=submitted`} />
        <Kpi label={t('dashboard.completed')} value={completed} href={`${base}?status=completed`} tone="good" />
        <Kpi label={t('dashboard.overdue')} value={overdue} href={`${base}?overdue=yes`} tone={overdue ? 'danger' : 'default'} />
        <Kpi label={t('dashboard.pendingExt')} value={pendingExt} href="/extensions?status=pending" tone={pendingExt ? 'warn' : 'default'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title={t('dashboard.pendingActions')} className="lg:col-span-1">
          {actions.every((a) => !a.n) ? <Empty text={t('dashboard.noPending')} /> : (
            <ul className="divide-y divide-ink-100">
              {actions.filter((a) => a.n).map((a) => (
                <li key={a.label}>
                  <Link href={a.href} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:text-brand-700">
                    <span className="text-ink-700">{a.label}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-800">{a.n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t('dashboard.byStatus')} className="lg:col-span-2"><HBar data={statusData} seriesName={t('dashboard.total')} /></Card>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {isMgr && (
          <Card title={t('dashboard.byEmployee')}>
            <StackedHBar data={empRows.slice(0, 15)} a={{ label: t('status.completed'), color: '#16a34a' }} b={{ label: t('dashboard.pending'), color: '#3b6cf6' }} />
          </Card>
        )}
        <Card title={t('dashboard.completedVsPending')}>
          <SplitBar parts={[
            { name: t('status.completed'), value: completed, color: '#16a34a' },
            { name: t('dashboard.pending'), value: live.filter((x) => !['completed', 'declined', 'new'].includes(x.status) && !x.is_overdue).length, color: '#3b6cf6' },
            { name: t('dashboard.overdue'), value: overdue, color: '#dc2626' },
            { name: t('dashboard.unassigned'), value: by('new') + by('declined'), color: '#94a3b8' },
          ]} />
        </Card>
        {isMgr && <Card title={t('dashboard.overdueByEmployee')}><HBar data={overdueRows} seriesName={t('dashboard.overdue')} /></Card>}
        <Card title={t('dashboard.byProject')}><HBar data={projRows} seriesName={t('dashboard.total')} /></Card>
        {isMgr && deptRows.length > 1 && <Card title={t('dashboard.byDepartment')}><HBar data={deptRows} seriesName={t('dashboard.total')} /></Card>}
      </div>

      <Card title={t('dashboard.recent')} className="mt-4">
        {(actData ?? []).length ? <Timeline items={actData as ActivityRow[]} showTask /> : <Empty />}
      </Card>
    </div>
  );
}
