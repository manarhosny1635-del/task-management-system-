'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { t } from '@/lib/i18n/t';
import { AuthCard } from '../AuthCard';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(params.get('unlinked') ? t('auth.notLinked') : null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    if (params.get('unlinked')) await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(t('auth.invalid'));
    router.replace(params.get('next') || '/');
    router.refresh();
  }

  return (
    <AuthCard title={t('auth.title')} subtitle={t('auth.subtitle')}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">{t('common.email')}</label>
          <input id="email" type="email" required autoComplete="email" dir="ltr" className="input text-start" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pw">{t('common.password')}</label>
          <input id="pw" type="password" required autoComplete="current-password" dir="ltr" className="input text-start" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('common.loading') : t('auth.login')}</button>
        <Link href="/forgot-password" className="block text-center text-sm text-brand-600 hover:underline">{t('auth.forgot')}</Link>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
