import type { TaskStatus } from './types';

/**
 * Kanban drag & drop → workflow mapping.
 * A column move is never a raw status write: each allowed move maps to one of the
 * existing, validated database actions (accept, start, submit, approve …).
 * The database re-checks role, ownership and the transition on every call.
 */
export type MoveAction =
  | { kind: 'accept' } | { kind: 'reject' }          // respond_to_assignment
  | { kind: 'assign' }                               // assign_task (needs an employee)
  | { kind: 'transition'; action: 'start' | 'hold' | 'resume' | 'submit' | 'approve' | 'request_changes' };

export interface MovePerms { isOwner: boolean; canManage: boolean; canReview: boolean }
export interface MoveTask { status: TaskStatus; requires_review: boolean }
export type Need = null | 'reason' | 'assignee';

/** Kanban column a status is shown in ("new" also holds tasks an employee declined). */
export const columnOf = (s: TaskStatus): TaskStatus => (s === 'declined' ? 'new' : s === 'cancelled' ? 'cancelled' : s);

export function moveFor(task: MoveTask, to: TaskStatus, p: MovePerms): { action: MoveAction; need: Need } | null {
  const from = task.status;
  if (columnOf(from) === to) return null;
  switch (to) {
    case 'pending_acceptance':
      if ((from === 'new' || from === 'declined') && p.canManage) return { action: { kind: 'assign' }, need: 'assignee' };
      return null;
    case 'new':
      if (from === 'pending_acceptance' && p.isOwner) return { action: { kind: 'reject' }, need: 'reason' };
      return null;
    case 'accepted':
      if (from === 'pending_acceptance' && p.isOwner) return { action: { kind: 'accept' }, need: null };
      return null;
    case 'in_progress':
      if ((from === 'accepted' || from === 'changes_requested') && p.isOwner) return { action: { kind: 'transition', action: 'start' }, need: null };
      if (from === 'on_hold' && (p.isOwner || p.canManage)) return { action: { kind: 'transition', action: 'resume' }, need: null };
      return null;
    case 'on_hold':
      if (['accepted', 'in_progress', 'changes_requested'].includes(from) && (p.isOwner || p.canManage))
        return { action: { kind: 'transition', action: 'hold' }, need: 'reason' };
      return null;
    case 'submitted':
      if ((from === 'in_progress' || from === 'changes_requested') && p.isOwner && task.requires_review)
        return { action: { kind: 'transition', action: 'submit' }, need: null };
      return null;
    case 'completed':
      if ((from === 'in_progress' || from === 'changes_requested') && p.isOwner && !task.requires_review)
        return { action: { kind: 'transition', action: 'submit' }, need: null };
      if (from === 'submitted' && p.canReview) return { action: { kind: 'transition', action: 'approve' }, need: null };
      return null;
    case 'changes_requested':
      if (from === 'submitted' && p.canReview) return { action: { kind: 'transition', action: 'request_changes' }, need: 'reason' };
      return null;
    default:
      return null;
  }
}

export function allowedColumns(task: MoveTask, p: MovePerms, columns: TaskStatus[]): Set<TaskStatus> {
  return new Set(columns.filter((c) => moveFor(task, c, p)));
}
