import Link from 'next/link';
import { t } from '@/lib/i18n/t';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { ActivityRow } from '@/lib/types';
import { Avatar } from './ui';

const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function activityText(a: Pick<ActivityRow, 'action' | 'details'>) {
  const d = a.details ?? {};
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v == null) continue;
    if (a.action === 'status_changed' && (k === 'from' || k === 'to')) vars[k] = t(`status.${v}`);
    else if (isDate(v)) vars[k] = fmtDate(v as string);
    else if (typeof v === 'object') continue;
    else vars[k] = String(v);
  }
  if (a.action === 'permission_changed' && d.permission) vars.permission = String(d.permission);
  return t(`activity.${a.action}`, vars);
}

export function Timeline({ items, showTask }: { items: ActivityRow[]; showTask?: boolean }) {
  return (
    <ol className="relative space-y-4 before:absolute before:inset-y-1 before:start-[13px] before:w-px before:bg-ink-200">
      {items.map((a) => {
        const note = (a.details?.note ?? (a.action === 'status_changed' ? null : null)) as string | null;
        return (
          <li key={a.id} className="relative flex gap-3">
            <div className="relative z-10 rounded-full ring-4 ring-white"><Avatar name={a.actor_name ?? t('activity.system')} /></div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="text-ink-900">
                <span className="font-semibold">{a.actor_name ?? t('activity.system')}</span>{' '}
                <span className="text-ink-700">{activityText(a)}</span>
                {showTask && a.task_id && (
                  <> · <Link href={`/tasks/${a.task_id}`} className="font-medium text-brand-600 hover:underline">{a.task_code} {a.task_title}</Link></>
                )}
              </div>
              {note && <div className="mt-1 rounded-md bg-ink-50 px-2 py-1 text-xs text-ink-600">{note}</div>}
              <div className="mt-0.5 text-xs text-ink-500">{fmtDateTime(a.created_at)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
