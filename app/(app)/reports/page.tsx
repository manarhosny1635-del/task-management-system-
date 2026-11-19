import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { fetchLookups, sp, type SearchParams } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { fmtDate } from '@/lib/format';
import { Card, Kpi, PageHeader, Empty } from '@/components/ui';
import { ExportButtons, type Sheet } from '@/components/ExportButton';
import { HBar } from '@/components/Charts';
import { ACTIVE_STATUSES } from '@/lib/constants';
import type { ExtensionRow, TaskRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Row = Record<string, string | number | null>;
function Table({ rows }: { rows: Row[] }) {
  if (!rows.length) return <Empty />;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full">
        <thead className="border-b border-ink-200 bg-ink-50"><tr>{cols.map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r, i) => <tr key={i}>{cols.map((c, j) => <td key={c} className={`td ${j ? 'tabular-nums' : 'font-medium'}`}>{r[c] ?? '—'}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const days = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86400000;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const s = await requireSession('reports.view');
  const period = sp(await searchParams, 'period');
  const since = period ? new Date(Date.now() - Number(period) * 86400000).toISOString() : null;
  const supabase = await createClient();
  let tq = supabase.from('task_overview').select('*').neq('status', 'cancelled');
  let eq = supabase.from('extension_overview').select('*');
  if (since) { tq = tq.gte('created_at', since); eq = eq.gte('created_at', since); }
  const [{ data: td }, { data: ed }, lk] = await Promise.all([tq.limit(10000), eq.limit(10000), fetchLookups()]);
  const tasks = (td ?? []) as TaskRow[];
  const exts = (ed ?? []) as ExtensionRow[];
  const R = (k: string) => t(`reports.${k}`);

  const completed = tasks.filter((x) => x.status === 'completed');
  const onTime = completed.filter((x) => x.completed_on_time !== false).length;
  const late = completed.length - onTime;
  const durations = completed.filter((x) => x.completed_at && (x.assigned_at ?? x.created_at)).map((x) => days(x.assigned_at ?? x.created_at, x.completed_at!));
  const overdue = tasks.filter((x) => x.is_overdue);

  const people = lk.people.filter((p) => tasks.some((x) => x.assignee_id === p.id) || exts.some((e) => e.requested_by === p.id));
  const perEmployee: Row[] = people.map((p) => {
    const m = tasks.filter((x) => x.assignee_id === p.id); const c = m.filter((x) => x.status === 'completed');
    return { [R('employee')]: p.full_name, [t('common.total')]: m.length, [R('active')]: m.filter((x) => ACTIVE_STATUSES.includes(x.status)).length,
      [t('status.completed')]: c.length, [R('onTimeCount')]: c.filter((x) => x.completed_on_time !== false).length,
      [R('lateCount')]: c.filter((x) => x.completed_on_time === false).length, [t('deadline.overdue')]: m.filter((x) => x.is_overdue).length,
      [R('avgDays')]: avg(c.filter((x) => x.completed_at).map((x) => days(x.assigned_at ?? x.created_at, x.completed_at!))) };
  }).filter((r) => (r[t('common.total')] as number) > 0).sort((a, b) => (b[t('common.total')] as number) - (a[t('common.total')] as number));

  const projNames = [...new Set(tasks.map((x) => x.project_name ?? t('common.noProject')))];
  const perProject: Row[] = projNames.map((n) => {
    const m = tasks.filter((x) => (x.project_name ?? t('common.noProject')) === n);
    return { [R('project')]: n, [t('common.total')]: m.length, [t('projects.open')]: m.filter((x) => x.status !== 'completed').length,
      [t('status.completed')]: m.filter((x) => x.status === 'completed').length, [t('deadline.overdue')]: m.filter((x) => x.is_overdue).length };
  }).sort((a, b) => (b[t('common.total')] as number) - (a[t('common.total')] as number));

  const overdueRows: Row[] = overdue.map((x) => ({ [t('tasks.code')]: x.code, [t('tasks.taskTitle')]: x.title, [R('employee')]: x.assignee_name,
    [t('tasks.currentDeadline')]: fmtDate(x.current_deadline), [t('tasks.status')]: t(`status.${x.status}`), [t('tasks.progress')]: `${x.progress}%` }));

  const extEmp: Row[] = [...new Set(exts.map((e) => e.requester_name ?? ''))].map((n) => {
    const m = exts.filter((e) => e.requester_name === n);
    return { [R('employee')]: n, [t('common.total')]: m.length, [R('approved')]: m.filter((e) => e.status === 'approved').length,
      [R('rejected')]: m.filter((e) => e.status === 'rejected').length, [R('pending')]: m.filter((e) => e.status === 'pending').length };
  }).sort((a, b) => (b[t('common.total')] as number) - (a[t('common.total')] as number));
  const extApproved = exts.filter((e) => e.status === 'approved').length;
  const extRejected = exts.filter((e) => e.status === 'rejected').length;

  const workload: Row[] = lk.people.filter((p) => p.is_active).map((p) => {
    const a = tasks.filter((x) => x.assignee_id === p.id && ACTIVE_STATUSES.includes(x.status)).length;
    return { [R('employee')]: p.full_name, [R('active')]: a, [t('team.capacity')]: p.max_active_tasks, [R('rate')]: `${Math.round((a / p.max_active_tasks) * 100)}%` };
  }).filter((r) => (r[R('active')] as number) > 0).sort((a, b) => (b[R('active')] as number) - (a[R('active')] as number));

  const sheets: Sheet[] = [
    { name: R('perEmployee'), rows: perEmployee }, { name: R('perProject'), rows: perProject }, { name: R('overdue'), rows: overdueRows },
    { name: R('extPerEmployee'), rows: extEmp }, { name: R('workload'), rows: workload },
  ];
  const periodLink = (v: string, label: string) => (
    <Link href={v ? `/reports?period=${v}` : '/reports'} className={`rounded-full px-3 py-1 text-sm ${period === v ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200'}`}>{label}</Link>
  );

  return (
    <div>
      <PageHeader title={R('title')} actions={s.can('reports.export') && <ExportButtons filename="reports" sheets={sheets} />} />
      <div className="mb-4 flex flex-wrap gap-1">{periodLink('', R('allTime'))}{periodLink('30', R('last30'))}{periodLink('90', R('last90'))}</div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={R('onTime')} value={completed.length ? `${Math.round((onTime / completed.length) * 100)}%` : '—'} tone="good" />
        <Kpi label={R('lateCount')} value={late} tone={late ? 'danger' : 'default'} />
        <Kpi label={R('overdue')} value={overdue.length} tone={overdue.length ? 'danger' : 'default'} />
        <Kpi label={R('avgTime')} value={durations.length ? `${avg(durations)} ${R('daysUnit')}` : '—'} />
        <Kpi label={R('extApprovedRejected')} value={`${extApproved} / ${extRejected}`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={R('perEmployee')} className="xl:col-span-2" bodyClass="p-0"><Table rows={perEmployee} /></Card>
        <Card title={R('perProject')} bodyClass="p-0"><Table rows={perProject} /></Card>
        <Card title={R('workload')}><HBar data={workload.map((w) => ({ name: String(w[R('employee')]), value: Number(w[R('active')]) }))} seriesName={R('active')} /></Card>
        <Card title={R('extPerEmployee')} bodyClass="p-0"><Table rows={extEmp} /></Card>
        <Card title={R('extApprovedRejected')}>
          <HBar data={[{ name: R('approved'), value: extApproved, color: '#16a34a' }, { name: R('rejected'), value: extRejected, color: '#dc2626' },
            { name: R('pending'), value: exts.filter((e) => e.status === 'pending').length, color: '#d97706' }]} seriesName={t('common.total')} height={150} />
        </Card>
        <Card title={R('overdue')} className="xl:col-span-2" bodyClass="p-0"><Table rows={overdueRows} /></Card>
      </div>
    </div>
  );
}
