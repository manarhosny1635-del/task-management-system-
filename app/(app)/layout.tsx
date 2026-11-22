import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Shell, type NavItem } from '@/components/Shell';
import type { QuickAddData } from '@/components/QuickAdd';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const supabase = await createClient();
  const canCreate = s.can('tasks.create');
  const [{ data: dept }, { data: company }, { count: pendingExt }, { count: pendingAccept }, people, projects, depts] = await Promise.all([
    s.profile.department_id ? supabase.from('departments').select('name').eq('id', s.profile.department_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('app_settings').select('value').eq('key', 'company_name').maybeSingle(),
    s.can('extensions.approve')
      ? supabase.from('extension_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').neq('requested_by', s.profile.id)
      : Promise.resolve({ count: 0 }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', s.profile.id).eq('status', 'pending_acceptance'),
    canCreate ? supabase.from('profiles').select('id,full_name,department_id').eq('is_active', true).order('full_name') : Promise.resolve({ data: [] }),
    canCreate ? supabase.from('projects').select('id,name').eq('status', 'active').order('name') : Promise.resolve({ data: [] }),
    canCreate ? supabase.from('departments').select('id,name') : Promise.resolve({ data: [] }),
  ]);

  // Navigation: one item per area; "My tasks", "Assign" and "Notifications" live inside Tasks / the header.
  const nav: NavItem[] = [{ href: '/', key: 'dashboard' }, { href: '/tasks', key: 'tasks', badge: pendingAccept ?? 0 }];
  if (s.isManager) nav.push({ href: '/projects', key: 'projects' });
  if (s.can('team.manage') || s.profile.role === 'team_leader') nav.push({ href: '/team', key: 'team' });
  nav.push({ href: '/extensions', key: 'extensions', badge: pendingExt ?? 0 });
  if (s.can('reports.view')) nav.push({ href: '/reports', key: 'reports' });
  if (s.can('settings.manage') || s.can('team.manage') || s.can('import.run')) nav.push({ href: '/settings', key: 'settings' });

  let quickAdd: QuickAddData | null = null;
  if (canCreate) {
    const deptName = new Map(((depts.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]));
    const list = ((people.data ?? []) as { id: string; full_name: string; department_id: string | null }[])
      .filter((p) => s.profile.role === 'admin' || p.department_id === s.profile.department_id || p.id === s.profile.id);
    quickAdd = {
      people: list.map((p) => ({ id: p.id, name: p.full_name, dept: p.department_id ? deptName.get(p.department_id) : undefined })),
      projects: (projects.data ?? []) as { id: string; name: string }[],
    };
  }

  return (
    <Shell nav={nav} profileId={s.profile.id} company={(company?.value as string) ?? ''} quickAdd={quickAdd}
      user={{ name: s.profile.full_name, role: s.profile.role, dept: (dept as { name: string } | null)?.name }}>
      {children}
    </Shell>
  );
}
