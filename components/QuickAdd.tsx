'use client';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { t } from '@/lib/i18n/t';
import { createTasks } from '@/lib/actions';
import { useAction } from './useAction';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { PRIORITIES, PRIORITY_DOT } from '@/lib/constants';
import { todayISO } from '@/lib/format';

export interface QuickAddData { people: { id: string; name: string; dept?: string }[]; projects: { id: string; name: string }[] }

const plusDays = (n: number) => { const d = new Date(todayISO() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function QuickAddButton({ data, className, children, defaults }:
  { data: QuickAddData; className?: string; children: ReactNode; defaults?: { assignee_id?: string; project_id?: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{children}</button>
      {open && <QuickAddModal data={data} defaults={defaults} onClose={() => setOpen(false)} />}
    </>
  );
}

export function QuickAddModal({ data, defaults, onClose }: { data: QuickAddData; defaults?: { assignee_id?: string; project_id?: string }; onClose: () => void }) {
  const { run, pending } = useAction();
  const toast = useToast();
  const titleRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const [more, setMore] = useState(false);
  const [f, setF] = useState({
    title: '', assignee_id: defaults?.assignee_id ?? '', deadline: '', priority: 'medium', project_id: defaults?.project_id ?? '',
    description: '', start_date: todayISO(), requires_review: true,
  });
  const set = (k: keyof typeof f, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const errs = { title: !f.title.trim(), deadline: !f.deadline };

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (errs.title || errs.deadline) { if (errs.title) titleRef.current?.focus(); return; }
    const res = await run(() => createTasks({ rows: [{
      title: f.title.trim(), description: f.description, assignee_id: f.assignee_id || undefined, priority: f.priority,
      start_date: f.start_date || undefined, deadline: f.deadline, project_id: f.project_id || undefined, requires_review: f.requires_review,
    }] }), '');
    if (res.ok && res.data) {
      toast(t('quick.created', { code: res.data.tasks[0]?.code }));
      onClose();
    }
  }

  const quickDates = [{ l: t('dash.dueToday'), v: plusDays(0) }, { l: t('dash.dueIn', { n: 1 }), v: plusDays(1) }, { l: t('dash.dueIn', { n: 3 }), v: plusDays(3) }, { l: t('dash.dueIn', { n: 7 }), v: plusDays(7) }];

  return (
    <Modal open wide title={t('quick.title')} onClose={onClose} footer={<>
      <Link href="/assign" onClick={onClose} className="btn-ghost me-auto text-xs">{t('quick.bulkLink')}</Link>
      <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={pending} onClick={() => submit()}>{pending ? t('board.saving') : t('quick.create')}</button>
    </>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <input ref={titleRef} autoFocus className={`input py-3 text-base ${touched && errs.title ? 'input-error' : ''}`} placeholder={t('quick.titlePh')}
            value={f.title} onChange={(e) => set('title', e.target.value)} aria-label={t('tasks.taskTitle')} />
          {touched && errs.title && <p className="mt-1 text-xs font-medium text-rose-700">{t('quick.titleRequired')}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t('tasks.assignee')}</label>
            <select className="input" value={f.assignee_id} onChange={(e) => set('assignee_id', e.target.value)}>
              <option value="">{t('assign.leaveUnassigned')}</option>
              {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.dept ? ` — ${p.dept}` : ''}</option>)}
            </select>
            {!f.assignee_id && <p className="hint">{t('quick.assigneeHint')}</p>}
          </div>
          <div>
            <label className="label">{t('tasks.deadline')} *</label>
            <input type="date" min={f.start_date || undefined} className={`input ${touched && errs.deadline ? 'input-error' : ''}`} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {quickDates.map((q) => (
                <button key={q.v} type="button" onClick={() => set('deadline', q.v)} className={`chip py-0.5 ${f.deadline === q.v ? 'chip-on' : ''}`}>{q.l}</button>
              ))}
            </div>
            {touched && errs.deadline && <p className="mt-1 text-xs font-medium text-rose-700">{t('quick.deadlineRequired')}</p>}
          </div>
        </div>

        <div>
          <label className="label">{t('tasks.priority')}</label>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-brand-100 p-1">
            {[...PRIORITIES].reverse().map((p) => (
              <button key={p} type="button" onClick={() => set('priority', p)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${f.priority === p ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_DOT[p as keyof typeof PRIORITY_DOT] }} />{t(`priority.${p}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">{t('tasks.project')}</label>
          <select className="input" value={f.project_id} onChange={(e) => set('project_id', e.target.value)}>
            <option value="">{t('common.noProject')}</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setMore(!more)}>{more ? t('quick.less') : `+ ${t('quick.more')}`}</button>
        {more && (
          <div className="grid gap-3 rounded-xl bg-brand-50 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">{t('tasks.description')}</label>
              <textarea rows={3} className="input" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
            <div><label className="label">{t('tasks.startDate')}</label>
              <input type="date" className="input" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} /></div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.requires_review} onChange={(e) => set('requires_review', e.target.checked)} />
              {t('tasks.requiresReview')}
            </label>
          </div>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
