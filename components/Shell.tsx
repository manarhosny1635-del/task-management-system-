'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { t } from '@/lib/i18n/t';
import { Avatar } from './ui';
import { NotificationBell } from './NotificationBell';
import { signOut } from '@/lib/actions';

const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z',
  allTasks: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  myTasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  assign: 'M12 5v14M5 12h14',
  team: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  extensions: 'M12 8v4l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  notifications: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6m7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2',
};
export function Icon({ name, className = 'h-[18px] w-[18px]' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={ICONS[name]} />
    </svg>
  );
}

export interface NavItem { href: string; key: string; badge?: number }

export function Shell({ nav, user, profileId, company, children }:
  { nav: NavItem[]; user: { name: string; role: string; dept?: string | null }; profileId: string; company: string; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></svg>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink-900">{t('app.name')}</div>
          <div className="truncate text-xs text-ink-500">{company}</div>
        </div>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 scroll-thin">
        {nav.map((n) => (
          <li key={n.href}>
            <Link href={n.href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active(n.href) ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'}`}>
              <Icon name={n.key} />
              <span className="flex-1">{t(`nav.${n.key}`)}</span>
              {!!n.badge && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">{n.badge}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-ink-100 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Avatar name={user.name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink-900">{user.name}</div>
            <div className="truncate text-xs text-ink-500">{t(`role.${user.role}`)}{user.dept ? ` · ${user.dept}` : ''}</div>
          </div>
          <form action={signOut}>
            <button className="btn-ghost btn-sm" title={t('nav.logout')} aria-label={t('nav.logout')}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e border-ink-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink-900/40" />
          <aside className="absolute inset-y-0 start-0 w-72 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-ink-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label={t('nav.menu')}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <div className="text-sm font-semibold text-ink-700 lg:hidden">{t('app.short')}</div>
          <div className="ms-auto flex items-center gap-2">
            <NotificationBell profileId={profileId} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
