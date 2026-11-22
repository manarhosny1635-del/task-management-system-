'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import type { ActionResult, TaskStatus } from './types';
import { moveFor } from './workflow';

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true, data: data as T };
}

// ---------- tasks ----------------------------------------------------
export interface NewTaskRow {
  title: string; description?: string; assignee_id?: string; priority?: string; start_date?: string;
  deadline?: string; project_id?: string; department_id?: string; requires_review?: boolean;
}
export async function createTasks(payload: { title?: string; note?: string; rows: NewTaskRow[] }) {
  return rpc<{ batch_id: string | null; tasks: { id: string; code: string }[] }>('create_tasks', { p_payload: payload });
}
export async function assignTask(taskId: string, assigneeId: string, note?: string) {
  return rpc('assign_task', { p_task: taskId, p_assignee: assigneeId, p_note: note ?? null });
}
export async function respondToAssignment(taskId: string, accept: boolean, reason?: string) {
  return rpc('respond_to_assignment', { p_task: taskId, p_accept: accept, p_reason: reason ?? null });
}
export async function transitionTask(taskId: string, action: string, note?: string) {
  return rpc<string>('transition_task', { p_task: taskId, p_action: action, p_note: note ?? null });
}
export async function updateTask(taskId: string, patch: Record<string, unknown>) {
  return rpc('update_task', { p_task: taskId, p_patch: patch });
}
export async function updateProgress(taskId: string, progress: number, note?: string) {
  return rpc('update_progress', { p_task: taskId, p_progress: progress, p_note: note ?? null });
}
export async function addComment(taskId: string, body: string) {
  return rpc('add_comment', { p_task: taskId, p_body: body });
}
export async function registerAttachment(taskId: string, extId: string | null, file: { name: string; path: string; type: string; size: number }) {
  return rpc('register_attachment', { p_task: taskId, p_ext: extId, p_file_name: file.name, p_path: file.path, p_mime: file.type, p_size: file.size });
}
export async function getAttachmentUrl(path: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 300);
  if (error || !data) return { ok: false, error: error?.message ?? 'err.not_allowed' };
  return { ok: true, data: data.signedUrl };
}

/** Kanban drop → the matching validated workflow action (the database re-checks everything). */
export async function moveTask(taskId: string, to: TaskStatus, opts: { reason?: string; assigneeId?: string } = {}): Promise<ActionResult<TaskStatus>> {
  const supabase = await createClient();
  const { data: task } = await supabase.from('tasks').select('status, requires_review').eq('id', taskId).maybeSingle();
  if (!task) return { ok: false, error: 'err.task_not_found' };
  const m = moveFor(task as { status: TaskStatus; requires_review: boolean }, to, { isOwner: true, canManage: true, canReview: true });
  if (!m) return { ok: false, error: 'err.invalid_transition' };
  const a = m.action;
  let res: ActionResult<unknown>;
  if (a.kind === 'accept') res = await rpc('respond_to_assignment', { p_task: taskId, p_accept: true, p_reason: null });
  else if (a.kind === 'reject') res = await rpc('respond_to_assignment', { p_task: taskId, p_accept: false, p_reason: opts.reason ?? null });
  else if (a.kind === 'assign') {
    if (!opts.assigneeId) return { ok: false, error: 'err.assignee_not_found' };
    res = await rpc('assign_task', { p_task: taskId, p_assignee: opts.assigneeId, p_note: null });
  } else res = await rpc('transition_task', { p_task: taskId, p_action: a.action, p_note: opts.reason ?? null });
  if (!res.ok) return res;
  const { data: after } = await supabase.from('tasks').select('status').eq('id', taskId).maybeSingle();
  return { ok: true, data: (after?.status ?? to) as TaskStatus };
}

// ---------- extensions -------------------------------------------------
export async function requestExtension(taskId: string, newDeadline: string, reason: string, notes?: string) {
  return rpc<string>('request_extension', { p_task: taskId, p_new_deadline: newDeadline, p_reason: reason, p_notes: notes ?? null });
}
export async function decideExtension(requestId: string, approve: boolean, reason?: string) {
  return rpc('decide_extension', { p_request: requestId, p_approve: approve, p_reason: reason ?? null });
}
export async function withdrawExtension(requestId: string) {
  return rpc('withdraw_extension', { p_request: requestId });
}

// ---------- notifications ---------------------------------------------
export async function markNotificationsRead(ids?: string[]) {
  return rpc('mark_notifications_read', { p_ids: ids ?? null });
}

// ---------- administration --------------------------------------------
export async function saveProfile(id: string | null, data: Record<string, unknown>) {
  return rpc<string>('save_profile', { p_id: id, p_data: data });
}
export async function setMemberPermission(profileId: string, perm: string, granted: boolean | null) {
  return rpc('set_member_permission', { p_profile: profileId, p_perm: perm, p_granted: granted });
}
export async function setRolePermission(role: string, perm: string, granted: boolean) {
  return rpc('set_role_permission', { p_role: role, p_perm: perm, p_granted: granted });
}
export async function saveDepartment(id: string | null, name: string, description: string, leaderId: string | null) {
  return rpc<string>('save_department', { p_id: id, p_name: name, p_description: description, p_leader: leaderId });
}
export async function saveProject(id: string | null, name: string, description: string, departmentId: string | null, status: string) {
  return rpc<string>('save_project', { p_id: id, p_name: name, p_description: description, p_department: departmentId, p_status: status });
}
export async function saveSetting(key: string, value: unknown) {
  return rpc('save_setting', { p_key: key, p_value: value });
}
export async function importSheet(payload: unknown) {
  return rpc<Record<string, unknown>>('import_sheet', { p_payload: payload });
}

/** Create a Supabase login for a team member (admin only). */
export async function createMemberLogin(profileId: string, email: string, password: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc('has_perm', { p_perm: 'team.manage' });
  if (!allowed) return { ok: false, error: 'err.not_allowed' };
  if (!password || password.length < 8) return { ok: false, error: 'err.password_short' };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'settings.serviceKeyMissing' };
  const { data, error } = await admin.auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true });
  if (error || !data.user) return { ok: false, error: /already/i.test(error?.message ?? '') ? 'err.email_taken' : error?.message ?? 'err.generic' };
  const link = await supabase.rpc('link_member_login', { p_profile: profileId, p_user: data.user.id, p_email: email });
  if (link.error) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: link.error.message };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
}
