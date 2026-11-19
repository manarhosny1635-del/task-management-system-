import { t } from './i18n/t';
import type { TaskRow } from './types';

export function taskExportRows(tasks: TaskRow[]) {
  return tasks.map((x) => ({
    [t('tasks.code')]: x.code, [t('tasks.taskTitle')]: x.title, [t('tasks.project')]: x.project_name, [t('tasks.department')]: x.department_name,
    [t('tasks.priority')]: t(`priority.${x.priority}`), [t('tasks.createdBy')]: x.creator_name, [t('tasks.assignee')]: x.assignee_name,
    [t('tasks.assignedAt')]: x.assigned_at?.slice(0, 10) ?? null, [t('tasks.acceptance')]: t(`acceptance.${x.acceptance}`),
    [t('tasks.status')]: t(`status.${x.status}`), [t('tasks.startDate')]: x.start_date, [t('tasks.originalDeadline')]: x.original_deadline,
    [t('tasks.currentDeadline')]: x.current_deadline, [t('tasks.completedAt')]: x.completed_at?.slice(0, 10) ?? null,
    [t('tasks.progress')]: x.progress, [t('deadline.overdue')]: x.is_overdue ? t('common.yes') : t('common.no'),
  }));
}
