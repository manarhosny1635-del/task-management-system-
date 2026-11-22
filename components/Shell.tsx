'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { t } from '@/lib/i18n/t';
import { Avatar } from './ui';
import { NotificationBell } from './NotificationBell';
import { QuickAddButton, type QuickAddData } from './QuickAdd';
import { signOut } from '@/lib/actions';

// One consistent 24px outline icon set (1.8 stroke) for the whole app.
const ICONS: Record<string, string> = {
  dashboard: 'M4 13h6V4H4zm10 7h6V11h-6zM4 20h6v-3H4zm10-16v3h6V4z',
  tasks: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z',
  allTasks: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  extensions: 'M12 8v4l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  notifications: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6m7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18',
  check: 'M20 6 9 17l-5-5',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  board: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z',
  x: 'M18 6 6 18M6 6l12 12',
  external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M3 6h18M3 12h18M3 18h18',
};
export function Icon({ name, className = 'h-[18px] w-[18px]' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name] ?? ICONS.dashboard} />
    </svg>
  );
}

export interface NavItem { href: string; key: string; badge?: number }

export function Shell({ nav, user, profileId, company, quickAdd, children }:
  { nav: NavItem[]; user: { name: string; role: string; dept?: string | null }; profileId: string; company: string; quickAdd: QuickAddData | null; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  // pages reached from inside an area keep that area highlighted
  const area = path.startsWith('/assign') || path.startsWith('/my-tasks') ? '/tasks' : path;
  const active = (href: string) => (href === '/' ? area === '/' : area === href || area.startsWith(href + '/'));
  const current = nav.find((n) => active(n.href));

  const sidebar = (
    <nav className="flex h-full flex-col bg-brand-600 text-white" aria-label={t('nav.menu')}>
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-300 text-brand-900">
          <Icon name="check" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{t('app.name')}</div>
          {company && <div className="truncate text-xs text-brand-200/80">{company}</div>}
        </div>
      </div>
      {quickAdd && (
        <div className="px-3 pb-3">
          <QuickAddButton data={quickAdd} className="btn w-full justify-center bg-brand-300 text-brand-900 hover:bg-brand-200">
            <Icon name="plus" className="h-4 w-4" /> {t('nav.newTask')}
          </QuickAddButton>
        </div>
      )}
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 scroll-thin">
        {nav.map((n) => {
          const on = active(n.href);
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={on ? 'page' : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${on ? 'bg-white/15 text-white' : 'text-brand-100/85 hover:bg-white/10 hover:text-white'}`}>
                {on && <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-brand-300" />}
                <Icon name={n.key} />
                <span className="flex-1">{t(`nav.${n.key}`)}</span>
                {!!n.badge && <span className="min-w-[20px] rounded-full bg-rose-200 px-1.5 text-center text-[11px] font-bold leading-5 text-rose-700">{n.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <Avatar name={user.name} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-xs text-brand-200/80">{t(`role.${user.role}`)}{user.dept ? ` · ${user.dept}` : ''}</div>
          </div>
          <form action={signOut}>
            <button className="rounded-lg p-2 text-brand-100 transition hover:bg-white/10 hover:text-white active:scale-95" title={t('nav.logout')} aria-label={t('nav.logout')}>
              <Icon name="logout" className="h-4 w-4 rtl:rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="anim-fade absolute inset-0 bg-brand-900/40" onClick={() => setOpen(false)} />
          <aside className="anim-sheet-start absolute inset-y-0 start-0 w-72 shadow-lift">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-brand-200/70 bg-brand-50/80 px-4 backdrop-blur-md sm:px-6">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label={t('nav.menu')}>
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <div className="truncate text-sm font-semibold text-ink-700">{current ? t(`nav.${current.key}`) : path.startsWith('/notifications') ? t('nav.notifications') : ''}</div>
          <div className="ms-auto flex items-center gap-1.5">
            {quickAdd && (
              <QuickAddButton data={quickAdd} className="btn-primary btn-sm lg:hidden">
                <Icon name="plus" className="h-4 w-4" /> {t('nav.newTask')}
              </QuickAddButton>
            )}
            <NotificationBell profileId={profileId} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
