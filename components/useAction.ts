'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import { errorText } from '@/lib/i18n';
import { t } from '@/lib/i18n/t';
import { emitChanged } from '@/lib/events';
import type { ActionResult } from '@/lib/types';

/** Runs a server action, shows a toast, refreshes server data and notifies open panels. */
export function useAction() {
  const [refreshing, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  async function run<T>(fn: () => Promise<ActionResult<T>>, okText?: string): Promise<ActionResult<T>> {
    setError(null);
    setBusy(true);
    let res: ActionResult<T>;
    try { res = await fn(); } catch { res = { ok: false, error: 'err.generic' }; }
    setBusy(false);
    if (!res.ok) {
      const msg = /^[a-z]+\.[a-zA-Z_]+$/.test(res.error) && !res.error.startsWith('err.') ? t(res.error) : errorText(t, res.error);
      setError(msg);
      toast(msg, 'error');
    } else {
      if (okText !== '') toast(okText ?? t('actions.done'));
      emitChanged();
      start(() => router.refresh());
    }
    return res;
  }
  return { run, pending: busy || refreshing, busy, error, setError };
}
