'use client';
import { useEffect, useRef } from 'react';

/** Tiny in-page event bus: any successful mutation announces itself so open
 *  panels (task drawer, board) can refresh their own data without a page reload. */
const EVENT = 'taskflow:changed';
export function emitChanged(detail?: unknown) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}
export function useOnChanged(cb: () => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const h = () => ref.current();
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
}
