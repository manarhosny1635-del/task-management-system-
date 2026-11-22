import type { TaskStatus, Priority, DeadlineState, ExtStatus } from './types';

export const STATUS_ORDER: TaskStatus[] = ['new', 'pending_acceptance', 'accepted', 'in_progress', 'on_hold', 'submitted', 'changes_requested', 'completed', 'declined', 'cancelled'];
export const ACTIVE_STATUSES: TaskStatus[] = ['pending_acceptance', 'accepted', 'in_progress', 'on_hold', 'submitted', 'changes_requested'];
export const WORKING_STATUSES: TaskStatus[] = ['accepted', 'in_progress', 'on_hold', 'changes_requested'];
export const KANBAN_COLUMNS: TaskStatus[] = ['new', 'pending_acceptance', 'accepted', 'in_progress', 'on_hold', 'submitted', 'changes_requested', 'completed'];
export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// One colour per status, used everywhere (badges, kanban, charts). Palette tones,
// plus functional amber/green/red only where a state must read as a signal.
export const STATUS_COLOR: Record<TaskStatus, string> = {
  new: '#B0A3A3', pending_acceptance: '#D59A2E', accepted: '#9DB5B5', in_progress: '#5D6B6B', on_hold: '#7D6F6F',
  submitted: '#4F8A8A', changes_requested: '#D1716E', completed: '#3F8A5C', declined: '#B4524F', cancelled: '#C2CCCC',
};
export const STATUS_BADGE: Record<TaskStatus, string> = {
  new: 'bg-sand-100 text-sand-700 ring-sand-200', pending_acceptance: 'bg-amber-50 text-amber-800 ring-amber-200',
  accepted: 'bg-brand-100 text-brand-800 ring-brand-300', in_progress: 'bg-brand-600 text-white ring-brand-600',
  on_hold: 'bg-sand-100 text-sand-700 ring-sand-400', submitted: 'bg-teal-50 text-teal-800 ring-teal-200',
  changes_requested: 'bg-rose-100 text-rose-700 ring-rose-200', completed: 'bg-green-50 text-green-800 ring-green-200',
  declined: 'bg-rose-100 text-rose-700 ring-rose-300', cancelled: 'bg-ink-100 text-ink-500 ring-ink-200',
};
export const PRIORITY_BADGE: Record<Priority, string> = {
  urgent: 'bg-rose-600 text-white ring-rose-600', high: 'bg-rose-100 text-rose-700 ring-rose-200',
  medium: 'bg-brand-100 text-brand-800 ring-brand-200', low: 'bg-sand-50 text-sand-700 ring-sand-200',
};
export const PRIORITY_DOT: Record<Priority, string> = { urgent: '#B4524F', high: '#D1716E', medium: '#7A8C8C', low: '#B0A3A3' };
export const DEADLINE_BADGE: Record<DeadlineState, string> = {
  none: 'text-ink-400', on_track: 'text-ink-700', due_soon: 'text-amber-700 font-semibold', overdue: 'text-rose-700 font-semibold',
  done_on_time: 'text-green-800', done_late: 'text-rose-700', done: 'text-green-800',
};
export const EXT_BADGE: Record<ExtStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200', approved: 'bg-green-50 text-green-800 ring-green-200',
  rejected: 'bg-rose-100 text-rose-700 ring-rose-200', withdrawn: 'bg-ink-100 text-ink-500 ring-ink-200',
};
