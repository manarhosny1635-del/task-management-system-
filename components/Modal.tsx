'use client';
import { useEffect, type ReactNode } from 'react';
import { t } from '@/lib/i18n/t';

export function Modal({ open, onClose, title, children, footer, wide }:
  { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
