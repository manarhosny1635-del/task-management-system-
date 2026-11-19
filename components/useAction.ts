'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import { errorText } from '@/lib/i18n';
import { t } from '@/lib/i18n/t';
import type { ActionResult } from '@/lib/types';

/** Runs a server action, shows a toast, refreshes the page data. */
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  async function run<T>(fn: () => Promise<ActionResult<T>>, okText?: string): Promise<ActionResult<T>> {
    setError(null);
    const res = await fn();
    if (!res.ok) {
      const msg = errorText(t, res.error) === res.error && res.error.includes('.') ? t(res.error) : errorText(t, res.error);
      setError(msg);
      toast(msg, 'error');
    } else {
      if (okText !== '') toast(okText ?? t('actions.done'));
      start(() => router.refresh());
    }
    return res;
  }
  return { run, pending, error, setError };
}
