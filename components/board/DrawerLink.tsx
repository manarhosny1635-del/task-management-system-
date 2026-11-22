'use client';
import { useState, type ReactNode } from 'react';
import { TaskDrawer } from './TaskDrawer';

/** Opens a task in the side drawer instead of navigating away. */
export function DrawerLink({ id, className, children, label }: { id: string; className?: string; children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={label}>{children}</button>
      {open && <TaskDrawer id={id} onClose={() => setOpen(false)} />}
    </>
  );
}
