export type Role = 'admin' | 'team_leader' | 'employee';
export type TaskStatus = 'new' | 'pending_acceptance' | 'accepted' | 'in_progress' | 'on_hold' | 'submitted' | 'changes_requested' | 'completed' | 'declined' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ExtStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type DeadlineState = 'none' | 'on_track' | 'due_soon' | 'overdue' | 'done_on_time' | 'done_late' | 'done';

export interface Profile {
  id: string; user_id: string | null; full_name: string; email: string | null; phone: string | null; job_title: string | null;
  role: Role; department_id: string | null; is_active: boolean; max_active_tasks: number; created_at: string;
}
export interface Department { id: string; name: string; description: string | null; leader_id: string | null; is_active: boolean }
export interface Project { id: string; name: string; description: string | null; department_id: string | null; status: string; created_at: string }

export interface TaskRow {
  id: string; code: string; title: string; description: string | null; project_id: string | null; department_id: string | null;
  batch_id: string | null; priority: Priority; created_by: string; assignee_id: string | null; suggested_assignee_id: string | null;
  assigned_at: string | null; acceptance: 'unassigned' | 'pending' | 'accepted' | 'rejected'; accepted_at: string | null;
  status: TaskStatus; requires_review: boolean; progress: number; start_date: string | null; original_deadline: string | null;
  current_deadline: string | null; submitted_at: string | null; completed_at: string | null; completed_on_time: boolean | null;
  reviewed_by: string | null; source: 'app' | 'import'; created_at: string; updated_at: string;
  assignee_name: string | null; assignee_department_id: string | null; creator_name: string | null; suggested_assignee_name: string | null;
  project_name: string | null; department_name: string | null; is_overdue: boolean; deadline_state: DeadlineState;
  deadline_extended: boolean; extension_count: number; has_pending_extension: boolean;
}

export interface ExtensionRow {
  id: string; task_id: string; requested_by: string; original_deadline: string; previous_deadline: string; requested_deadline: string;
  reason: string; notes: string | null; progress_at_request: number | null; status: ExtStatus; decided_by: string | null;
  decided_at: string | null; decision_reason: string | null; created_at: string; task_code: string; task_title: string;
  task_status: TaskStatus; task_progress: number; task_original_deadline: string | null; task_current_deadline: string | null;
  project_id: string | null; department_id: string | null; assignee_id: string | null; project_name: string | null;
  department_name: string | null; requester_name: string | null; decider_name: string | null; previous_requests: number;
}

export interface ActivityRow {
  id: number; task_id: string | null; actor_id: string | null; action: string; details: Record<string, unknown>; created_at: string;
  actor_name: string | null; task_code: string | null; task_title: string | null;
}

export interface NotificationRow {
  id: string; recipient_id: string; type: string; task_id: string | null; extension_request_id: string | null;
  data: Record<string, string>; is_read: boolean; created_at: string;
}

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
