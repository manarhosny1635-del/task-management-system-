'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; text: string; kind: 'ok' | 'error' };
const Ctx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} role={i.kind === 'error' ? 'alert' : 'status'}
            className={`anim-pop pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold shadow-lift ${i.kind === 'ok' ? 'bg-brand-800 text-white' : 'border border-rose-300 bg-rose-50 text-rose-700'}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${i.kind === 'ok' ? 'bg-brand-300 text-brand-900' : 'bg-rose-600 text-white'}`}>{i.kind === 'ok' ? '✓' : '!'}</span>
            {i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
