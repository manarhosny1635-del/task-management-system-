import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { Profile } from './types';

export const ALL_PERMS = ['tasks.create', 'tasks.review', 'tasks.view_all', 'extensions.approve', 'team.manage',
  'projects.manage', 'reports.view', 'reports.export', 'settings.manage', 'import.run'] as const;
export type Perm = (typeof ALL_PERMS)[number];

export interface Session { userId: string; profile: Profile; perms: Set<Perm>; can: (p: Perm) => boolean; isManager: boolean }

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!profile) return { userId: user.id, profile: null as unknown as Profile, perms: new Set(), can: () => false, isManager: false };
  let perms = new Set<Perm>();
  if (profile.role === 'admin') perms = new Set(ALL_PERMS);
  else {
    const [{ data: rp }, { data: pp }] = await Promise.all([
      supabase.from('role_permissions').select('permission').eq('role', profile.role),
      supabase.from('profile_permissions').select('permission, granted').eq('profile_id', profile.id),
    ]);
    (rp ?? []).forEach((r: { permission: string }) => perms.add(r.permission as Perm));
    (pp ?? []).forEach((r: { permission: string; granted: boolean }) => (r.granted ? perms.add(r.permission as Perm) : perms.delete(r.permission as Perm)));
  }
  return {
    userId: user.id, profile: profile as Profile, perms, can: (p) => perms.has(p),
    isManager: profile.role !== 'employee' || perms.has('tasks.create'),
  };
});

export async function requireSession(perm?: Perm): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (!s.profile) redirect('/login?unlinked=1');
  if (perm && !s.can(perm)) redirect('/');
  return s;
}
