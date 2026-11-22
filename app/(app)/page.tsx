import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/t';
import { daysBetween, fmtDate, todayISO } from '@/lib/format';
import { Avatar, Card, Empty, Kpi, PageHeader } from '@/components/ui';
import { Timeline } from '@/components/Activity';
import { Icon } from '@/components/Shell';
import { DrawerLink } from '@/components/board/DrawerLink';
import { ACTIVE_STATUSES } from '@/lib/constants';
import { workloadLevel } from '@/lib/workload';
import type { ActivityRow, TaskRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Row = Pick<TaskRow, 'id' | 'code' | 'title' | 'status' | 'assignee_id' | 'assignee_name' | 'is_overdue' | 'deadline_state' | 'current_deadline' | 'assigned_at' | 'submitted_at' | 'priority' | 'project_name'>;
interface Group { key: string; tone: 'rose' | 'amber' | 'brand' | 'sand'; icon: string; items: Row[]; href: string; meta: (r: Row) => string; cta: string }

const TONE = {
  rose: { box: 'border-rose-200 bg-rose-50/50', chip: 'bg-rose-200 text-rose-700', icon: 'bg-rose-200 text-rose-700' },
  amber: { box: 'border-amber-200 bg-amber-50/40', chip: 'bg-amber-100 text-amber-800', icon: 'bg-amber-100 text-amber-700' },
  brand: { box: 'border-brand-200 bg-brand-50', chip: 'bg-brand-200 text-brand-800', icon: 'bg-brand-200 text-brand-700' },
  sand: { box: 'border-sand-200 bg-sand-50', chip: 'bg-sand-200 text-sand-700', icon: 'bg-sand-200 text-sand-700' },
};

export default async function Dashboard() {
  const s = await requireSession();
  const supabase = await createClient();
  if (s.profile.role === 'admin') await supabase.rpc('run_deadline_checks');
  const isMgr = s.isManager;
  const me = s.profile.id;

  let tq = supabase.from('task_overview')
    .select('id,code,title,status,assignee_id,assignee_name,is_overdue,deadline_state,current_deadline,assigned_at,submitted_at,priority,project_name')
    .neq('status', 'cancelled');
  if (!isMgr) tq = tq.eq('assignee_id', me);
  const [{ data: taskData }, { data: actData }, { data: extData }, { data: people }] = await Promise.all([
    tq.limit(5000),
    supabase.from('activity_overview').select('*').not('task_id', 'is', null).order('id', { ascending: false }).limit(8),
    s.can('extensions.approve')
      ? supabase.from('extension_overview').select('id,task_id,task_code,task_title,requester_name,requested_deadline,created_at,requested_by,assignee_id').eq('status', 'pending').limit(50)
      : Promise.resolve({ data: [] }),
    isMgr ? supabase.from('profiles').select('id,full_name,max_active_tasks,department_id,role').eq('is_active', true) : Promise.resolve({ data: [] }),
  ]);
  const tasks = (taskData ?? []) as Row[];
  const today = todayISO();
  const count = (f: (r: Row) => boolean) => tasks.filter(f).length;
  const inProgress = count((r) => ['accepted', 'in_progress', 'on_hold', 'changes_requested'].includes(r.status));
  const completed = count((r) => r.status === 'completed');
  const overdue = tasks.filter((r) => r.is_overdue).sort((a, b) => (a.current_deadline ?? '').localeCompare(b.current_deadline ?? ''));
  const soon = tasks.filter((r) => r.deadline_state === 'due_soon').sort((a, b) => (a.current_deadline ?? '').localeCompare(b.current_deadline ?? ''));
  const base = isMgr ? '/tasks?' : '/tasks?mine=1&';

  const lateBy = (r: Row) => t('dash.lateBy', { n: daysBetween(r.current_deadline!, today) });
  const dueIn = (r: Row) => { const n = daysBetween(today, r.current_deadline!); return n <= 0 ? t('dash.dueToday') : t('dash.dueIn', { n }); };
  const since = (iso?: string | null) => t('dash.since', { d: fmtDate(iso) });

  const groups: Group[] = isMgr ? [
    { key: 'g_overdue', tone: 'rose', icon: 'alert', items: overdue, href: `${base}overdue=yes`, meta: lateBy, cta: t('dash.open') },
    { key: 'g_soon', tone: 'amber', icon: 'clock', items: soon, href: `${base}sort=deadline`, meta: dueIn, cta: t('dash.open') },
    { key: 'g_accept', tone: 'sand', icon: 'inbox', items: tasks.filter((r) => r.status === 'pending_acceptance'), href: `${base}status=pending_acceptance`, meta: (r) => since(r.assigned_at), cta: t('dash.open') },
    { key: 'g_review', tone: 'brand', icon: 'check', items: tasks.filter((r) => r.status === 'submitted' && r.assignee_id !== me), href: `${base}status=submitted`, meta: (r) => since(r.submitted_at), cta: t('dash.review') },
    { key: 'g_declined', tone: 'rose', icon: 'user', items: tasks.filter((r) => r.status === 'declined'), href: `${base}status=declined`, meta: () => t('status.declined'), cta: t('dash.assign') },
  ] : [
    { key: 'g_overdue', tone: 'rose', icon: 'alert', items: overdue, href: `${base}overdue=yes`, meta: lateBy, cta: t('dash.open') },
    { key: 'g_soon', tone: 'amber', icon: 'clock', items: soon, href: base, meta: dueIn, cta: t('dash.open') },
    { key: 'g_myAccept', tone: 'sand', icon: 'inbox', items: tasks.filter((r) => r.status === 'pending_acceptance'), href: `${base}status=pending_acceptance`, meta: (r) => since(r.assigned_at), cta: t('dash.open') },
    { key: 'g_changes', tone: 'brand', icon: 'check', items: tasks.filter((r) => r.status === 'changes_requested'), href: `${base}status=changes_requested`, meta: () => t('status.changes_requested'), cta: t('dash.open') },
  ];
  const exts = ((extData ?? []) as { id: string; task_id: string; task_code: string; task_title: string; requester_name: string; requested_deadline: string; created_at: string; requested_by: string; assignee_id: string }[])
    .filter((e) => e.requested_by !== me && e.assignee_id !== me);
  const visibleGroups = groups.filter((g) => g.items.length);
  const attentionTotal = visibleGroups.reduce((n, g) => n + g.items.length, 0) + exts.length;

  // team workload
  const team = ((people ?? []) as { id: string; full_name: string; max_active_tasks: number; department_id: string | null; role: string }[])
    .filter((p) => s.profile.role === 'admin' || s.can('tasks.view_all') || p.department_id === s.profile.department_id)
    .map((p) => {
      const mine = tasks.filter((r) => r.assignee_id === p.id);
      const active = mine.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;
      return { p, total: mine.length, active, done: mine.filter((r) => r.status === 'completed').length, late: mine.filter((r) => r.is_overdue).length, level: workloadLevel(active, p.max_active_tasks) };
    })
    .filter((x) => x.total > 0 || x.p.role !== 'admin')
    .sort((a, b) => b.level.pct - a.level.pct || b.late - a.late);

  return (
    <div className="space-y-5">
      <PageHeader title={t('dash.hello', { name: s.profile.full_name.split(' ')[0] })} subtitle={isMgr ? t('dash.subtitle') : t('dash.subtitleMine')} />

      {/* A. Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('dash.total')} value={tasks.length} href={base.slice(0, -1)} icon={<Icon name="tasks" />} />
        <Kpi label={t('dash.inProgress')} value={inProgress} href={`${base}status=in_progress`} tone="brand" icon={<Icon name="clock" />} />
        <Kpi label={t('dash.completed')} value={completed} href={`${base}status=completed`} tone="good" icon={<Icon name="check" />}
          sub={tasks.length ? `${Math.round((completed / tasks.length) * 100)}%` : undefined} />
        <Kpi label={t('dash.overdue')} value={overdue.length} href={`${base}overdue=yes`} tone={overdue.length ? 'danger' : 'default'} icon={<Icon name="alert" />} />
      </div>

      {/* B. Needs attention */}
      <section className="card overflow-hidden" aria-labelledby="att">
        <header className="flex items-center gap-3 border-b border-brand-100 px-4 py-3.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${attentionTotal ? 'bg-rose-200 text-rose-700' : 'bg-green-50 text-[#3F8A5C]'}`}>
            <Icon name={attentionTotal ? 'alert' : 'check'} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="att" className="section-title">{t('dash.attention')} {attentionTotal > 0 && <span className="ms-1 rounded-full bg-rose-200 px-2 text-xs text-rose-700">{attentionTotal}</span>}</h2>
            <p className="text-xs text-ink-500">{t('dash.attentionSub')}</p>
          </div>
          <Link href="/tasks" className="btn-ghost btn-sm">{t('dash.viewAll')}</Link>
        </header>
        {!attentionTotal ? (
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
            <span className="text-sm font-semibold text-ink-800">{t('dash.allClear')}</span>
            <span className="text-xs text-ink-500">{t('dash.allClearSub')}</span>
          </div>
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {exts.length > 0 && (
              <div className={`rounded-xl border p-3 ${TONE.amber.box}`}>
                <GroupHead tone="amber" icon="clock" title={t('dash.g_ext')} n={exts.length} href="/extensions?status=pending" />
                <ul className="mt-2 space-y-1.5">
                  {exts.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 shadow-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-ink-900">{e.task_title}</div>
                        <div className="truncate text-[11px] text-ink-500">{e.requester_name} · {t('ext.requested')}: {fmtDate(e.requested_deadline)}</div>
                      </div>
                      <DrawerLink id={e.task_id} className="btn-soft btn-sm">{t('dash.decide')}</DrawerLink>
                    </li>
                  ))}
                </ul>
                {exts.length > 4 && <Link href="/extensions?status=pending" className="mt-2 block text-center text-xs font-semibold text-ink-600 hover:underline">{t('dash.more', { n: exts.length - 4 })}</Link>}
              </div>
            )}
            {visibleGroups.map((g) => (
              <div key={g.key} className={`rounded-xl border p-3 ${TONE[g.tone].box}`}>
                <GroupHead tone={g.tone} icon={g.icon} title={t(`dash.${g.key}`)} n={g.items.length} href={g.href} />
                <ul className="mt-2 space-y-1.5">
                  {g.items.slice(0, 4).map((r) => (
                    <li key={r.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 shadow-sm">
                      {isMgr && <Avatar name={r.assignee_name ?? '?'} size={26} />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-ink-900">{r.title}</div>
                        <div className="truncate text-[11px] text-ink-500">{isMgr && r.assignee_name ? `${r.assignee_name.split(' ').slice(0, 2).join(' ')} · ` : ''}<span className={g.tone === 'rose' ? 'font-semibold text-rose-700' : ''}>{g.meta(r)}</span></div>
                      </div>
                      <DrawerLink id={r.id} className="btn-soft btn-sm">{g.cta}</DrawerLink>
                    </li>
                  ))}
                </ul>
                {g.items.length > 4 && <Link href={g.href} className="mt-2 block text-center text-xs font-semibold text-ink-600 hover:underline">{t('dash.more', { n: g.items.length - 4 })}</Link>}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={`grid items-start gap-5 ${isMgr ? 'xl:grid-cols-5' : ''}`}>
        {/* C. Team workload */}
        {isMgr && (
          <Card className="xl:col-span-3" bodyClass="p-0"
            title={<span>{t('dash.workload')}<span className="block text-xs font-normal text-ink-500">{t('dash.workloadSub')}</span></span>}
            actions={<Link href="/team" className="btn-ghost btn-sm">{t('dash.viewAll')}</Link>}>
            {!team.length ? <Empty text={t('dash.noTeam')} /> : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[560px]">
                  <thead><tr className="border-b border-brand-100">
                    <th className="th">{t('reports.employee')}</th><th className="th w-[34%]">{t('dash.capacity')}</th>
                    <th className="th text-center">{t('dash.colTotal')}</th><th className="th text-center">{t('dash.colActive')}</th>
                    <th className="th text-center">{t('dash.colDone')}</th><th className="th text-center">{t('dash.colOverdue')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-brand-100">
                    {team.slice(0, 12).map(({ p, total, active, done, late, level }) => (
                      <tr key={p.id} className="hover:bg-brand-50">
                        <td className="td"><Link href={`/team/${p.id}`} className="inline-flex max-w-[210px] items-center gap-2 hover:text-brand-700">
                          <Avatar name={p.full_name} size={26} /><span className="truncate text-[13px] font-medium">{p.full_name}</span></Link></td>
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-100">
                              <div className={`h-full rounded-full ${level.cls}`} style={{ width: `${Math.min(100, level.pct)}%` }} />
                            </div>
                            <span className={`w-16 shrink-0 text-[11px] font-semibold ${level.text}`}>{active === 0 ? t('dash.idle') : t(`team.${level.key}`)}</span>
                          </div>
                        </td>
                        <td className="td text-center tabular-nums">{total}</td>
                        <td className="td text-center font-semibold tabular-nums">{active}</td>
                        <td className="td text-center tabular-nums text-[#3F8A5C]">{done}</td>
                        <td className="td text-center tabular-nums">{late ? <span className="rounded-full bg-rose-200 px-2 py-0.5 text-xs font-bold text-rose-700">{late}</span> : <span className="text-ink-300">0</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* D. Recent activity */}
        <Card title={t('dash.recent')} className={isMgr ? 'xl:col-span-2' : ''}>
          {(actData ?? []).length ? <Timeline items={actData as ActivityRow[]} showTask compact /> : <Empty />}
        </Card>
      </div>
    </div>
  );
}

function GroupHead({ tone, icon, title, n, href }: { tone: keyof typeof TONE; icon: string; title: string; n: number; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${TONE[tone].icon}`}><Icon name={icon} className="h-4 w-4" /></span>
      <span className="flex-1 text-[13px] font-bold text-ink-800">{title}</span>
      <span className={`rounded-full px-2 text-xs font-bold tabular-nums ${TONE[tone].chip}`}>{n}</span>
    </Link>
  );
}
