import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/t';
import { fmtDate, relTime } from '@/lib/format';
import { Empty, PageHeader } from '@/components/ui';
import { MarkAllRead, MarkOnOpen } from './NotifClient';
import type { NotificationRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

function text(n: NotificationRow) {
  const d: Record<string, string> = {};
  for (const [k, v] of Object.entries(n.data ?? {})) d[k] = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDate(v) : String(v ?? '');
  d.title = d.code ? `${d.code} «${d.title}»` : d.title;
  return t(`notifications.t.${n.type}`, d);
}

export default async function NotificationsPage() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200);
  const rows = (data ?? []) as NotificationRow[];
  const unread = rows.filter((r) => !r.is_read).length;
  return (
    <div>
      <PageHeader title={t('notifications.title')} subtitle={unread ? `${unread} ${t('notifications.unread')}` : undefined} actions={unread > 0 && <MarkAllRead />} />
      <div className="card divide-y divide-ink-100">
        {!rows.length ? <Empty text={t('notifications.empty')} /> : rows.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.is_read ? '' : 'bg-brand-50/50'}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-brand-600'}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${n.is_read ? 'text-ink-700' : 'font-medium text-ink-900'}`}>{text(n)}</p>
              <p className="mt-0.5 text-xs text-ink-500">{relTime(n.created_at)}</p>
            </div>
            {n.task_id && <MarkOnOpen id={n.id} read={n.is_read}><Link href={`/tasks/${n.task_id}`} className="btn-secondary btn-sm">{t('notifications.open')}</Link></MarkOnOpen>}
          </div>
        ))}
      </div>
    </div>
  );
}
