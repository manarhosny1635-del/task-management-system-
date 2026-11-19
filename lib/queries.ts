import 'server-only';
import { createClient } from './supabase/server';
import type { TaskRow, Profile, Project, Department } from './types';

export type SearchParams = Record<string, string | string[] | undefined>;
export const sp = (p: SearchParams, k: string) => (Array.isArray(p[k]) ? (p[k] as string[])[0] : (p[k] as string | undefined)) ?? '';

export interface TaskFilter {
  q?: string; assignee?: string; project?: string; department?: string; status?: string; priority?: string;
  overdue?: string; dfrom?: string; dto?: string; afrom?: string; ato?: string; sort?: string; dir?: string;
}

export function filterFromParams(p: SearchParams): TaskFilter {
  const keys: (keyof TaskFilter)[] = ['q', 'assignee', 'project', 'department', 'status', 'priority', 'overdue', 'dfrom', 'dto', 'afrom', 'ato', 'sort', 'dir'];
  return Object.fromEntries(keys.map((k) => [k, sp(p, k)])) as TaskFilter;
}

export async function fetchTasks(f: TaskFilter, extra?: { assigneeId?: string; statuses?: string[]; limit?: number }) {
  const supabase = await createClient();
  let q = supabase.from('task_overview').select('*');
  if (extra?.assigneeId) q = q.eq('assignee_id', extra.assigneeId);
  if (extra?.statuses?.length) q = q.in('status', extra.statuses);
  if (f.q) {
    const term = f.q.replace(/[%,()]/g, ' ').trim();
    q = q.or(`title.ilike.%${term}%,code.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (f.assignee === 'none') q = q.is('assignee_id', null);
  else if (f.assignee) q = q.eq('assignee_id', f.assignee);
  if (f.project === 'none') q = q.is('project_id', null);
  else if (f.project) q = q.eq('project_id', f.project);
  if (f.department === 'none') q = q.is('department_id', null);
  else if (f.department) q = q.eq('department_id', f.department);
  if (f.status === 'active') q = q.in('status', ['pending_acceptance', 'accepted', 'in_progress', 'on_hold', 'submitted', 'changes_requested']);
  else if (f.status) q = q.eq('status', f.status);
  if (f.priority) q = q.eq('priority', f.priority);
  if (f.overdue === 'yes') q = q.eq('is_overdue', true);
  if (f.overdue === 'no') q = q.eq('is_overdue', false);
  if (f.dfrom) q = q.gte('current_deadline', f.dfrom);
  if (f.dto) q = q.lte('current_deadline', f.dto);
  if (f.afrom) q = q.gte('assigned_at', f.afrom);
  if (f.ato) q = q.lte('assigned_at', f.ato + 'T23:59:59');

  const asc = f.dir !== 'desc';
  switch (f.sort) {
    case 'priority': q = q.order('priority', { ascending: !asc }).order('current_deadline', { ascending: true, nullsFirst: false }); break;
    case 'created': q = q.order('created_at', { ascending: !asc }); break;
    case 'status': q = q.order('status', { ascending: asc }).order('current_deadline', { ascending: true, nullsFirst: false }); break;
    default: q = q.order('current_deadline', { ascending: asc, nullsFirst: false }).order('priority', { ascending: false });
  }
  const { data, error } = await q.limit(extra?.limit ?? 1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRow[];
}

export async function fetchLookups() {
  const supabase = await createClient();
  const [people, projects, departments] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('projects').select('*').order('name'),
    supabase.from('departments').select('*').order('name'),
  ]);
  return {
    people: (people.data ?? []) as Profile[],
    projects: (projects.data ?? []) as Project[],
    departments: (departments.data ?? []) as Department[],
  };
}
