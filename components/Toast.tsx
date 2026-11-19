'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; text: string; kind: 'ok' | 'error' };
const Ctx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((i) => (
          <div key={i.id} role="status"
            className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${i.kind === 'ok' ? 'bg-ink-900 text-white' : 'bg-red-600 text-white'}`}>
            {i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
