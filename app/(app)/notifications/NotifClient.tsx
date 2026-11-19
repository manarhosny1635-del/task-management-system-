'use client';
import type { ReactNode } from 'react';
import { t } from '@/lib/i18n/t';
import { markNotificationsRead } from '@/lib/actions';
import { useAction } from '@/components/useAction';

export function MarkAllRead() {
  const { run, pending } = useAction();
  return <button className="btn-secondary" disabled={pending} onClick={() => run(() => markNotificationsRead(), '')}>{t('notifications.markAll')}</button>;
}
export function MarkOnOpen({ id, read, children }: { id: string; read: boolean; children: ReactNode }) {
  return <span onClickCapture={() => { if (!read) markNotificationsRead([id]); }}>{children}</span>;
}
