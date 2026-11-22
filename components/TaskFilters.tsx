'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { t } from '@/lib/i18n/t';
import { STATUS_ORDER, PRIORITIES } from '@/lib/constants';
import { Icon } from './Shell';

interface Opt { id: string; name: string }

function useParamSetter() {
  const router = useRouter(); const path = usePathname(); const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v); else p.delete(k);
    start(() => router.push(`${path}?${p.toString()}`, { scroll: false }));
  };
  return { set, params, path, router, pending, start };
}

export function TaskFilters({ people, projects, departments, hide = [], showSort = true }:
  { people: Opt[]; projects: Opt[]; departments: Opt[]; hide?: string[]; showSort?: boolean }) {
  const { set, params, path, router, pending, start } = useParamSetter();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [mobile, setMobile] = useState(false);
  const [more, setMore] = useState(['dfrom', 'dto', 'afrom', 'ato', 'department', 'overdue'].some((k) => params.get(k)));
  useEffect(() => {
    const h = setTimeout(() => { if ((params.get('q') ?? '') !== q) set('q', q); }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sel = (k: string, label: string, opts: { v: string; l: string }[]) => hide.includes(k) ? null : (
    <select aria-label={label} className={`input w-[9.5rem] truncate py-1.5 ${params.get(k) ? 'border-brand-500 bg-brand-50 font-semibold' : ''}`}
      value={params.get(k) ?? ''} onChange={(e) => set(k, e.target.value)}>
      <option value="">{label}</option>
      {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  const date = (k: string, label: string) => (
    <label className="flex items-center gap-1.5 text-xs font-medium text-ink-600">{label}
      <input type="date" className="input w-auto py-1.5" value={params.get(k) ?? ''} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  const keep = ['view', 'tab', 'sort', 'dir', 'mine'];
  const active = [...params.keys()].filter((k) => !keep.includes(k)).length;

  return (
    <div className="mb-4 rounded-2xl border border-brand-200 bg-white p-2.5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
          <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="input py-1.5 ps-9" placeholder={t('tasks.searchPh')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
        </div>
        <button className={`chip sm:hidden ${active ? 'chip-on' : ''}`} onClick={() => setMobile(!mobile)}>{t('common.filters')}{active ? ` (${active})` : ''}</button>
        <div className={`${mobile ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-2 sm:contents`}>
        {sel('assignee', t('tasks.assignee'), [{ v: 'none', l: t('common.unassigned') }, ...people.map((p) => ({ v: p.id, l: p.name }))])}
        {sel('project', t('tasks.project'), [{ v: 'none', l: t('common.noProject') }, ...projects.map((p) => ({ v: p.id, l: p.name }))])}
        {sel('priority', t('tasks.priority'), PRIORITIES.map((s) => ({ v: s, l: t(`priority.${s}`) })))}
        {sel('status', t('tasks.status'), STATUS_ORDER.map((s) => ({ v: s, l: t(`status.${s}`) })))}
        <button className={`chip ${more ? 'chip-on' : ''}`} onClick={() => setMore(!more)}>{t('common.filters')} +</button>
        </div>
        {active > 0 && (
          <button className="chip border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => { setQ(''); const p = new URLSearchParams(); keep.forEach((k) => params.get(k) && p.set(k, params.get(k)!)); start(() => router.push(`${path}?${p}`, { scroll: false })); }}>
            {t('common.reset')} ({active})
          </button>
        )}
        {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-label={t('common.loading')} />}
        {showSort && (
          <div className={`${mobile ? 'flex' : 'hidden'} ms-auto items-center gap-1.5 sm:flex`}>
            <select aria-label={t('common.sortBy')} className="input w-auto py-1.5" value={params.get('sort') ?? 'deadline'} onChange={(e) => set('sort', e.target.value === 'deadline' ? '' : e.target.value)}>
              {(['deadline', 'priority', 'created', 'status'] as const).map((s) => <option key={s} value={s}>{t('common.sortBy')}: {t(`tasks.sort.${s}`)}</option>)}
            </select>
            <button className="btn-secondary btn-sm h-[34px] w-[34px] p-0" title="↑↓" aria-label="↑↓" onClick={() => set('dir', params.get('dir') === 'desc' ? '' : 'desc')}>{params.get('dir') === 'desc' ? '↓' : '↑'}</button>
          </div>
        )}
      </div>
      {more && (
        <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-brand-100 pt-2.5">
          {sel('department', t('tasks.department'), [{ v: 'none', l: t('common.noDepartment') }, ...departments.map((p) => ({ v: p.id, l: p.name }))])}
          {sel('overdue', t('deadline.overdue'), [{ v: 'yes', l: t('tasks.overdueOnly') }, { v: 'no', l: t('tasks.notOverdue') }])}
          {date('dfrom', t('tasks.deadlineFrom'))}{date('dto', t('tasks.deadlineTo'))}
          {date('afrom', t('tasks.assignedFrom'))}{date('ato', t('tasks.assignedTo'))}
        </div>
      )}
    </div>
  );
}

export function ViewToggle({ mineToggle }: { mineToggle?: boolean }) {
  const { set, params } = useParamSetter();
  const view = params.get('view') ?? 'board';
  const mine = params.get('mine') === '1';
  return (
    <div className="flex items-center gap-2">
      {mineToggle && (
        <div className="inline-flex rounded-xl bg-brand-100 p-1" role="tablist">
          {[['', t('board.all')], ['1', t('board.mine')]].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={(v === '1') === mine} onClick={() => set('mine', v)}
              className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${(v === '1') === mine ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}>{l}</button>
          ))}
        </div>
      )}
      <div className="inline-flex rounded-xl bg-brand-100 p-1" role="tablist">
        {[['board', t('board.boardView'), 'board'], ['list', t('board.listView'), 'list']].map(([v, l, ic]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => set('view', v === 'board' ? '' : v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-semibold transition ${view === v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}>
            <Icon name={ic} className="h-4 w-4" />{l}
          </button>
        ))}
      </div>
    </div>
  );
}
