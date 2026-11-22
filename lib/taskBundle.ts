'use server';

import { createClient } from './supabase/server';
import { getSession } from './session';
import { managesTask, canDecideExtension } from './scope';
import { todayISO } from './format';
import type { ActivityRow, ExtensionRow, TaskRow } from './types';

export interface TaskBundle {
  task: TaskRow;
  perms: { isOwner: boolean; canManage: boolean; canReview: boolean; canChangeDeadline: boolean };
  assignments: { id: string; from_name: string | null; to_name: string; by_name: string; response: string; response_reason: string | null; note: string | null; created_at: string }[];
  extensions: (ExtensionRow & { canDecide: boolean; canWithdraw: boolean })[];
  comments: { id: string; author: string; kind: string; body: string; created_at: string }[];
  attachments: { id: string; file_name: string; storage_path: string; size_bytes: number | null; uploader: string; created_at: string; ext: boolean }[];
  activity: ActivityRow[];
  people: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  today: string;
}

/** Everything the task drawer needs, read with the caller's own permissions (RLS). */
export async function getTaskBundle(id: string): Promise<TaskBundle | null> {
  const s = await getSession();
  if (!s?.profile) return null;
  const supabase = await createClient();
  const { data: task } = await supabase.from('task_overview').select('*').eq('id', id).maybeSingle<TaskRow>();
  if (!task) return null;
  const [assign, exts, comments, files, acts, people, projects, departments] = await Promise.all([
    supabase.from('assignment_overview').select('*').eq('task_id', id).order('created_at'),
    supabase.from('extension_overview').select('*').eq('task_id', id).order('created_at', { ascending: false }),
    supabase.from('task_comments').select('*').eq('task_id', id).order('created_at', { ascending: false }),
    supabase.from('attachments').select('*').eq('task_id', id).order('created_at', { ascending: false }),
    supabase.from('activity_overview').select('*').eq('task_id', id).order('id', { ascending: true }),
    supabase.from('profiles').select('id,full_name,department_id,is_active').order('full_name'),
    supabase.from('projects').select('id,name').order('name'),
    supabase.from('departments').select('id,name').order('name'),
  ]);
  const ppl = (people.data ?? []) as { id: string; full_name: string; department_id: string | null; is_active: boolean }[];
  const names = new Map(ppl.map((p) => [p.id, p.full_name]));
  const isOwner = task.assignee_id === s.profile.id;
  const canManage = s.can('tasks.create') && managesTask(s, task);
  return {
    task,
    perms: { isOwner, canManage, canReview: canManage && s.can('tasks.review') && !isOwner, canChangeDeadline: canManage && s.can('extensions.approve') },
    assignments: (assign.data ?? []) as TaskBundle['assignments'],
    extensions: ((exts.data ?? []) as ExtensionRow[]).map((e) => ({ ...e, canDecide: canDecideExtension(s, e, task.created_by), canWithdraw: e.status === 'pending' && e.requested_by === s.profile.id })),
    comments: (comments.data ?? []).map((c) => ({ id: c.id, kind: c.kind, body: c.body, created_at: c.created_at, author: names.get(c.author_id) ?? '' })),
    attachments: (files.data ?? []).map((a) => ({ id: a.id, file_name: a.file_name, storage_path: a.storage_path, size_bytes: a.size_bytes, created_at: a.created_at, uploader: names.get(a.uploaded_by) ?? '', ext: !!a.extension_request_id })),
    activity: (acts.data ?? []) as ActivityRow[],
    people: ppl.filter((p) => p.is_active && (s.profile.role === 'admin' || p.department_id === s.profile.department_id || p.id === s.profile.id)).map((p) => ({ id: p.id, name: p.full_name })),
    projects: (projects.data ?? []) as { id: string; name: string }[],
    departments: (departments.data ?? []) as { id: string; name: string }[],
    today: todayISO(),
  };
}
