import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Shell, type NavItem } from '@/components/Shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const supabase = await createClient();
  const [{ data: dept }, { data: company }, { count: pendingExt }, { count: pendingAccept }] = await Promise.all([
    s.profile.department_id ? supabase.from('departments').select('name').eq('id', s.profile.department_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('app_settings').select('value').eq('key', 'company_name').maybeSingle(),
    s.can('extensions.approve')
      ? supabase.from('extension_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').neq('requested_by', s.profile.id)
      : Promise.resolve({ count: 0 }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', s.profile.id).eq('status', 'pending_acceptance'),
  ]);

  const nav: NavItem[] = [{ href: '/', key: 'dashboard' }];
  if (s.isManager || s.can('tasks.view_all')) nav.push({ href: '/tasks', key: 'allTasks' });
  nav.push({ href: '/my-tasks', key: 'myTasks', badge: pendingAccept ?? 0 });
  if (s.can('tasks.create')) nav.push({ href: '/assign', key: 'assign' });
  if (s.can('team.manage') || s.profile.role === 'team_leader') nav.push({ href: '/team', key: 'team' });
  if (s.isManager) nav.push({ href: '/projects', key: 'projects' });
  nav.push({ href: '/extensions', key: 'extensions', badge: pendingExt ?? 0 });
  if (s.can('reports.view')) nav.push({ href: '/reports', key: 'reports' });
  nav.push({ href: '/notifications', key: 'notifications' });
  if (s.can('settings.manage') || s.can('team.manage') || s.can('import.run')) nav.push({ href: '/settings', key: 'settings' });

  return (
    <Shell nav={nav} profileId={s.profile.id} company={(company?.value as string) ?? ''}
      user={{ name: s.profile.full_name, role: s.profile.role, dept: (dept as { name: string } | null)?.name }}>
      {children}
    </Shell>
  );
}
