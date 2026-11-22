'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { t } from '@/lib/i18n/t';
import { AuthCard } from '../../(auth)/AuthCard';

export default function ResetPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr(t('err.password_short'));
    const { error } = await createClient().auth.updateUser({ password: pw });
    if (error) return setErr(error.message);
    router.replace('/');
  }
  return (
    <AuthCard title={t('auth.newPassword')}>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <input type="password" required minLength={8} dir="ltr" className="input text-start" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button className="btn-primary w-full">{t('auth.setPassword')}</button>
      </form>
    </AuthCard>
  );
}
