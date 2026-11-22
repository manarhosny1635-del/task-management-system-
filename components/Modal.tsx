'use client';
import { useEffect, type ReactNode } from 'react';
import { t } from '@/lib/i18n/t';

export function Modal({ open, onClose, title, children, footer, wide, description }:
  { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; description?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="anim-fade absolute inset-0 bg-brand-900/40" onMouseDown={onClose} />
      <div role="dialog" aria-modal className={`anim-pop relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-lift sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
          <div>
            <h3 className="text-base font-bold text-ink-900">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button className="btn-ghost btn-sm -me-2" onClick={onClose} aria-label={t('common.close')}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-brand-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
