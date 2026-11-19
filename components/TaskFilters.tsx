'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n/t';
import { STATUS_ORDER, PRIORITIES } from '@/lib/constants';

interface Opt { id: string; name: string }
export function TaskFilters({ people, projects, departments, hide = [] }: { people: Opt[]; projects: Opt[]; departments: Opt[]; hide?: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [more, setMore] = useState(['dfrom', 'dto', 'afrom', 'ato'].some((k) => params.get(k)));

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.push(`${path}?${p.toString()}`);
  };
  useEffect(() => {
    const h = setTimeout(() => { if ((params.get('q') ?? '') !== q) set('q', q); }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sel = (k: string, label: string, opts: { v: string; l: string }[]) => hide.includes(k) ? null : (
    <select aria-label={label} className="input w-auto min-w-[9rem] py-1.5" value={params.get(k) ?? ''} onChange={(e) => set(k, e.target.value)}>
      <option value="">{label}: {t('common.all')}</option>
      {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  const date = (k: string, label: string) => (
    <label className="flex items-center gap-1.5 text-xs text-ink-600">{label}
      <input type="date" className="input w-auto py-1.5" value={params.get(k) ?? ''} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  const active = [...params.keys()].filter((k) => !['view', 'tab', 'sort', 'dir'].includes(k)).length;

  return (
    <div className="card mb-4 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-full py-1.5 sm:w-64" placeholder={t('tasks.searchPh')} value={q} onChange={(e) => setQ(e.target.value)} />
        {sel('assignee', t('tasks.assignee'), [{ v: 'none', l: t('common.unassigned') }, ...people.map((p) => ({ v: p.id, l: p.name }))])}
        {sel('project', t('tasks.project'), [{ v: 'none', l: t('common.noProject') }, ...projects.map((p) => ({ v: p.id, l: p.name }))])}
        {sel('department', t('tasks.department'), [{ v: 'none', l: t('common.noDepartment') }, ...departments.map((p) => ({ v: p.id, l: p.name }))])}
        {sel('status', t('tasks.status'), STATUS_ORDER.map((s) => ({ v: s, l: t(`status.${s}`) })))}
        {sel('priority', t('tasks.priority'), PRIORITIES.map((s) => ({ v: s, l: t(`priority.${s}`) })))}
        {sel('overdue', t('deadline.overdue'), [{ v: 'yes', l: t('tasks.overdueOnly') }, { v: 'no', l: t('tasks.notOverdue') }])}
        <button className="btn-ghost btn-sm" onClick={() => setMore(!more)}>{more ? '−' : '+'} {t('tasks.deadline')} / {t('tasks.assignedAt')}</button>
        {active > 0 && <button className="btn-ghost btn-sm text-red-600" onClick={() => { setQ(''); router.push(path + (params.get('view') ? `?view=${params.get('view')}` : '')); }}>{t('common.reset')} ({active})</button>}
        <div className="ms-auto flex items-center gap-2">
          <select aria-label={t('common.sortBy')} className="input w-auto py-1.5" value={params.get('sort') ?? 'deadline'} onChange={(e) => set('sort', e.target.value)}>
            {(['deadline', 'priority', 'created', 'status'] as const).map((s) => <option key={s} value={s}>{t('common.sortBy')}: {t(`tasks.sort.${s}`)}</option>)}
          </select>
          <button className="btn-secondary btn-sm" title="↑↓" onClick={() => set('dir', params.get('dir') === 'desc' ? '' : 'desc')}>{params.get('dir') === 'desc' ? '↓' : '↑'}</button>
        </div>
      </div>
      {more && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3">
          {date('dfrom', t('tasks.deadlineFrom'))}{date('dto', t('tasks.deadlineTo'))}
          {date('afrom', t('tasks.assignedFrom'))}{date('ato', t('tasks.assignedTo'))}
        </div>
      )}
    </div>
  );
}

export function ViewToggle() {
  const router = useRouter(); const path = usePathname(); const params = useSearchParams();
  const view = params.get('view') ?? 'table';
  const go = (v: string) => { const p = new URLSearchParams(params.toString()); if (v === 'table') p.delete('view'); else p.set('view', v); router.push(`${path}?${p}`); };
  return (
    <div className="inline-flex rounded-lg border border-ink-300 bg-white p-0.5">
      {['table', 'kanban'].map((v) => (
        <button key={v} onClick={() => go(v)} className={`rounded-md px-3 py-1 text-sm ${view === v ? 'bg-brand-600 text-white' : 'text-ink-600'}`}>{t(`common.${v}`)}</button>
      ))}
    </div>
  );
}
