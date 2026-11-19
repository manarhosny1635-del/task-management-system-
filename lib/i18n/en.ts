import type { Dict } from './ar';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

// English dictionary. Any key missing here falls back to Arabic, so new
// features can ship in Arabic first and be translated later.
const en: DeepPartial<Dict> = {
  app: { name: 'Task Management System', short: 'Tasks', tagline: 'Team tasks, deadlines and approvals' },
  nav: {
    dashboard: 'Dashboard', allTasks: 'All Tasks', myTasks: 'My Tasks', assign: 'Task Assignments', team: 'Team Members',
    projects: 'Projects', extensions: 'Deadline Extension Requests', reports: 'Reports', notifications: 'Notifications',
    settings: 'Settings', logout: 'Log out', menu: 'Menu',
  },
  status: {
    new: 'New / Unassigned', pending_acceptance: 'Pending Acceptance', accepted: 'Accepted', in_progress: 'In Progress',
    on_hold: 'On Hold', submitted: 'Submitted for Review', changes_requested: 'Changes Requested', completed: 'Completed',
    declined: 'Rejected by assignee', cancelled: 'Cancelled',
  },
  acceptance: { unassigned: 'Unassigned', pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' },
  priority: { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' },
  extStatus: { pending: 'Pending Approval', approved: 'Approved', rejected: 'Rejected', withdrawn: 'Withdrawn' },
  deadline: { none: 'No deadline', on_track: 'On track', due_soon: 'Due soon', overdue: 'Overdue', done_on_time: 'Done on time', done_late: 'Done late', done: 'Done' },
  role: { admin: 'Admin', team_leader: 'Team Leader', employee: 'Employee' },
  common: {
    save: 'Save', cancel: 'Cancel', confirm: 'Confirm', search: 'Search', filters: 'Filters', all: 'All', loading: 'Loading…',
    close: 'Close', edit: 'Edit', add: 'Add', remove: 'Remove', export: 'Export', exportExcel: 'Export Excel', exportCsv: 'Export CSV',
    yes: 'Yes', no: 'No', reason: 'Reason', notes: 'Notes', back: 'Back', view: 'View', details: 'Details', required: 'Required',
    optional: 'Optional', apply: 'Apply', reset: 'Clear filters', unassigned: 'Unassigned', noDepartment: 'No department',
    noProject: 'No project', empty: 'No data', saved: 'Saved', done: 'Done', today: 'Today', days: 'days', select: 'Select…',
    submit: 'Submit', name: 'Name', email: 'Email', active: 'Active', inactive: 'Inactive', status: 'Status', actions: 'Actions',
    total: 'Total', viewAll: 'View all', table: 'Table', kanban: 'Kanban', password: 'Password', description: 'Description',
  },
  dashboard: {
    title: 'Dashboard', total: 'Total Tasks', unassigned: 'New / Unassigned', awaiting: 'Awaiting Acceptance',
    inProgress: 'In Progress', review: 'Under Review', completed: 'Completed', overdue: 'Overdue', pendingExt: 'Pending Extensions',
    byStatus: 'Tasks by Status', byEmployee: 'Tasks by Employee', completedVsPending: 'Completed vs. Pending',
    overdueByEmployee: 'Overdue by Employee', byProject: 'Distribution by Project', recent: 'Recent Activity',
    pendingActions: 'Pending Management Actions',
  },
};

export default en;
