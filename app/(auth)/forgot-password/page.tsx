'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { t } from '@/lib/i18n/t';
import { AuthCard } from '../AuthCard';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${site}/auth/callback?next=/auth/reset` });
    setBusy(false); setSent(true);
  }
  return (
    <AuthCard title={t('auth.forgot')}>
      {sent ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t('auth.resetSent')}</p> : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="label">{t('common.email')}</label>
            <input type="email" required dir="ltr" className="input text-start" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{t('auth.sendReset')}</button>
        </form>
      )}
      <Link href="/login" className="mt-4 block text-center text-sm text-brand-600 hover:underline">{t('auth.backToLogin')}</Link>
    </AuthCard>
  );
}
