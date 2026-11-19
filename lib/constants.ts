import type { TaskStatus, Priority, DeadlineState, ExtStatus } from './types';

export const STATUS_ORDER: TaskStatus[] = ['new', 'pending_acceptance', 'accepted', 'in_progress', 'on_hold', 'submitted', 'changes_requested', 'completed', 'declined', 'cancelled'];
export const ACTIVE_STATUSES: TaskStatus[] = ['pending_acceptance', 'accepted', 'in_progress', 'on_hold', 'submitted', 'changes_requested'];
export const WORKING_STATUSES: TaskStatus[] = ['accepted', 'in_progress', 'on_hold', 'changes_requested'];
export const KANBAN_COLUMNS: TaskStatus[] = ['new', 'pending_acceptance', 'accepted', 'in_progress', 'on_hold', 'submitted', 'changes_requested', 'completed'];
export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// one colour per status, used everywhere (badges, charts, kanban)
export const STATUS_COLOR: Record<TaskStatus, string> = {
  new: '#64748b', pending_acceptance: '#d97706', accepted: '#0891b2', in_progress: '#2563eb', on_hold: '#9333ea',
  submitted: '#7c3aed', changes_requested: '#ea580c', completed: '#16a34a', declined: '#dc2626', cancelled: '#94a3b8',
};
export const STATUS_BADGE: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-700 ring-slate-200', pending_acceptance: 'bg-amber-50 text-amber-800 ring-amber-200',
  accepted: 'bg-cyan-50 text-cyan-800 ring-cyan-200', in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  on_hold: 'bg-purple-50 text-purple-700 ring-purple-200', submitted: 'bg-violet-50 text-violet-700 ring-violet-200',
  changes_requested: 'bg-orange-50 text-orange-700 ring-orange-200', completed: 'bg-green-50 text-green-700 ring-green-200',
  declined: 'bg-red-50 text-red-700 ring-red-200', cancelled: 'bg-slate-50 text-slate-500 ring-slate-200',
};
export const PRIORITY_BADGE: Record<Priority, string> = {
  urgent: 'bg-red-600 text-white ring-red-600', high: 'bg-red-50 text-red-700 ring-red-200',
  medium: 'bg-amber-50 text-amber-800 ring-amber-200', low: 'bg-slate-50 text-slate-600 ring-slate-200',
};
export const DEADLINE_BADGE: Record<DeadlineState, string> = {
  none: 'text-ink-400', on_track: 'text-ink-700', due_soon: 'text-amber-700 font-semibold', overdue: 'text-red-600 font-semibold',
  done_on_time: 'text-green-700', done_late: 'text-red-600', done: 'text-green-700',
};
export const EXT_BADGE: Record<ExtStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200', approved: 'bg-green-50 text-green-700 ring-green-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200', withdrawn: 'bg-slate-50 text-slate-500 ring-slate-200',
};
