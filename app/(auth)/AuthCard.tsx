import type { ReactNode } from 'react';
import { t } from '@/lib/i18n/t';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-200 via-brand-50 to-brand-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></svg>
          </div>
          <div className="text-lg font-bold text-ink-900">{t('app.name')}</div>
        </div>
        <div className="card p-6 sm:p-7">
          <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
          {subtitle && <p className="mb-5 mt-1 text-sm text-ink-500">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
