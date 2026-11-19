import type { Session } from './session';
import type { TaskRow, ExtensionRow } from './types';

/** Mirrors public.is_task_manager() for UI decisions; the database re-checks every action. */
export function managesTask(s: Session, task: Pick<TaskRow, 'created_by' | 'department_id'> & { assignee_department_id?: string | null }) {
  const p = s.profile;
  if (p.role === 'admin') return true;
  if (p.role !== 'team_leader') return false;
  return task.created_by === p.id || (!!p.department_id && (task.department_id === p.department_id || task.assignee_department_id === p.department_id));
}

export function canDecideExtension(s: Session, e: Pick<ExtensionRow, 'requested_by' | 'assignee_id' | 'department_id' | 'status'>, createdBy?: string) {
  if (e.status !== 'pending' || !s.can('extensions.approve')) return false;
  if (e.requested_by === s.profile.id || e.assignee_id === s.profile.id) return false;
  if (s.profile.role === 'admin') return true;
  return createdBy === s.profile.id || (!!s.profile.department_id && e.department_id === s.profile.department_id);
}
