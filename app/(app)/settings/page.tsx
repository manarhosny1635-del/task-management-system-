import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession, ALL_PERMS } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { fetchLookups, sp, type SearchParams } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { PageHeader, Card, Avatar } from '@/components/ui';
import { Timeline } from '@/components/Activity';
import { MemberEditor, DepartmentEditor, RolePermToggle, GeneralSettings } from './SettingsClient';
import type { ActivityRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const s = await requireSession();
  const tabs = [
    s.can('team.manage') && 'members', s.can('team.manage') && 'departments', s.can('settings.manage') && 'permissions',
    s.can('settings.manage') && 'general', s.can('import.run') && 'importData', s.can('team.manage') && 'auditLog',
  ].filter(Boolean) as string[];
  if (!tabs.length) redirect('/');
  const tab = tabs.includes(sp(await searchParams, 'tab')) ? sp(await searchParams, 'tab') : tabs[0];
  if (tab === 'importData') redirect('/settings/import');
  const supabase = await createClient();
  const lk = await fetchLookups();
  const depts = lk.departments.map((d) => ({ id: d.id, name: d.name }));

  let body: React.ReactNode = null;
  if (tab === 'members') {
    const { data: pp } = await supabase.from('profile_permissions').select('*');
    const { data: perms } = await supabase.from('permissions').select('*');
    body = (
      <Card title={t('settings.members_count', { n: lk.people.length })} actions={<MemberEditor departments={depts} perms={perms ?? []} overrides={[]} />} bodyClass="p-0">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-ink-200 bg-ink-50"><tr>
              <th className="th">{t('common.name')}</th><th className="th">{t('settings.role')}</th><th className="th">{t('settings.department')}</th>
              <th className="th">{t('settings.loginEmail')}</th><th className="th">{t('common.status')}</th><th className="th" />
            </tr></thead>
            <tbody className="divide-y divide-ink-100">
              {lk.people.map((p) => (
                <tr key={p.id} className={p.is_active ? '' : 'opacity-60'}>
                  <td className="td"><span className="inline-flex items-center gap-2"><Avatar name={p.full_name} />{p.full_name}</span>
                    {p.job_title && <div className="ms-9 text-xs text-ink-500">{p.job_title}</div>}</td>
                  <td className="td text-sm">{t(`role.${p.role}`)}</td>
                  <td className="td text-sm text-ink-600">{lk.departments.find((d) => d.id === p.department_id)?.name ?? '—'}</td>
                  <td className="td text-sm" dir="ltr">{p.user_id ? p.email : <span className="text-ink-400">{t('team.noLogin')}</span>}</td>
                  <td className="td text-sm">{p.is_active ? t('common.active') : t('common.inactive')}</td>
                  <td className="td text-end"><MemberEditor member={p} departments={depts} perms={perms ?? []} overrides={(pp ?? []).filter((x) => x.profile_id === p.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  } else if (tab === 'departments') {
    const people = lk.people.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.full_name }));
    body = (
      <Card title={t('settings.departments')} actions={<DepartmentEditor people={people} />} bodyClass="p-0">
        <ul className="divide-y divide-ink-100">
          {lk.departments.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1"><div className="font-medium">{d.name}</div>
                <div className="text-xs text-ink-500">{t('settings.leader')}: {lk.people.find((p) => p.id === d.leader_id)?.full_name ?? '—'} · {t('settings.members_count', { n: lk.people.filter((p) => p.department_id === d.id).length })}</div></div>
              <DepartmentEditor dept={d} people={people} />
            </li>
          ))}
          {!lk.departments.length && <li className="p-4 text-sm text-ink-500">—</li>}
        </ul>
      </Card>
    );
  } else if (tab === 'permissions') {
    const [{ data: perms }, { data: rp }] = await Promise.all([supabase.from('permissions').select('*'), supabase.from('role_permissions').select('*')]);
    body = (
      <Card title={t('settings.permissions')} bodyClass="p-0">
        <p className="px-4 pt-3 text-xs text-ink-500">{t('settings.adminHasAll')}</p>
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="border-b border-ink-200"><tr><th className="th" /><th className="th">{t('role.team_leader')}</th><th className="th">{t('role.employee')}</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {ALL_PERMS.map((k) => (
              <tr key={k}><td className="td">{(perms ?? []).find((p) => p.key === k)?.label_ar ?? k}</td>
                {(['team_leader', 'employee'] as const).map((r) => <td key={r} className="td"><RolePermToggle role={r} perm={k} on={(rp ?? []).some((x) => x.role === r && x.permission === k)} /></td>)}</tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    );
  } else if (tab === 'general') {
    const { data } = await supabase.from('app_settings').select('*');
    const get = (k: string) => (data ?? []).find((x) => x.key === k)?.value;
    body = <Card title={t('settings.general')}><GeneralSettings company={String(get('company_name') ?? '')} dueSoon={Number(get('due_soon_days') ?? 2)} /></Card>;
  } else if (tab === 'auditLog') {
    const { data } = await supabase.from('activity_overview').select('*').order('id', { ascending: false }).limit(200);
    body = <Card title={t('settings.auditLog')}><Timeline items={(data ?? []) as ActivityRow[]} showTask /></Card>;
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ink-200 scroll-thin">
        {tabs.map((k) => (
          <Link key={k} href={k === 'importData' ? '/settings/import' : `/settings?tab=${k}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>{t(`settings.${k}`)}</Link>
        ))}
      </div>
      {body}
    </div>
  );
}
