'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { t } from '@/lib/i18n/t';
import { createTasks } from '@/lib/actions';
import { useAction } from '@/components/useAction';
import { Modal } from '@/components/Modal';
import { PRIORITIES } from '@/lib/constants';
import { todayISO } from '@/lib/format';

interface Opt { id: string; name: string; dept?: string }
interface Row { key: number; title: string; description: string; assignee_id: string; priority: string; start_date: string; deadline: string; project_id: string; requires_review: boolean }

let seq = 1;
const blank = (d: Partial<Row> = {}): Row => ({ key: seq++, title: '', description: '', assignee_id: '', priority: 'medium', start_date: todayISO(), deadline: '', project_id: '', requires_review: true, ...d });

export function BatchForm({ people, projects, defaultEmployee }: { people: Opt[]; projects: Opt[]; defaultEmployee?: string }) {
  const { run, pending } = useAction();
  const [batchTitle, setBatchTitle] = useState('');
  const [defEmp, setDefEmp] = useState(defaultEmployee ?? '');
  const [defProj, setDefProj] = useState('');
  const [rows, setRows] = useState<Row[]>(() => [blank({ assignee_id: defaultEmployee ?? '' })]);
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [created, setCreated] = useState<{ id: string; code: string }[] | null>(null);

  const upd = (key: number, k: keyof Row, v: unknown) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [k]: v } : r)));
  const add = () => setRows((rs) => [...rs, blank({ assignee_id: defEmp, project_id: defProj, start_date: rs[rs.length - 1]?.start_date ?? todayISO() })]);
  const dup = (r: Row) => setRows((rs) => { const i = rs.findIndex((x) => x.key === r.key); const c = [...rs]; c.splice(i + 1, 0, { ...r, key: seq++, title: '' }); return c; });
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));

  const errors = useMemo(() => rows.map((r) => ({
    title: !r.title.trim(), deadline: !r.deadline, order: !!(r.start_date && r.deadline && r.start_date > r.deadline),
  })), [rows]);
  const valid = errors.every((e) => !e.title && !e.deadline && !e.order);
  const employees = new Set(rows.map((r) => r.assignee_id).filter(Boolean)).size;

  async function save() {
    const res = await run(() => createTasks({
      title: batchTitle,
      rows: rows.map((r) => ({ title: r.title.trim(), description: r.description, assignee_id: r.assignee_id || undefined, priority: r.priority,
        start_date: r.start_date || undefined, deadline: r.deadline, project_id: r.project_id || undefined, requires_review: r.requires_review })),
    }), t('assign.created', { n: rows.length }));
    setConfirm(false);
    if (res.ok && res.data) { setCreated(res.data.tasks); setRows([blank({ assignee_id: defEmp, project_id: defProj })]); setBatchTitle(''); setTouched(false); }
  }

  const err = (b: boolean) => (touched && b ? 'border-red-400 ring-1 ring-red-200' : '');

  return (
    <div className="space-y-4">
      {created && (
        <div className="card border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <b>{t('assign.created', { n: created.length })}:</b>{' '}
          {created.map((c, i) => <span key={c.id}>{i > 0 && '، '}<Link className="font-mono underline" href={`/tasks/${c.id}`}>{c.code}</Link></span>)}
        </div>
      )}

      <div className="card grid gap-3 p-4 sm:grid-cols-3">
        <div><label className="label">{t('assign.batchTitle')}</label><input className="input" value={batchTitle} onChange={(e) => setBatchTitle(e.target.value)} /></div>
        <div>
          <label className="label">{t('assign.defaultEmployee')}</label>
          <div className="flex gap-2">
            <select className="input" value={defEmp} onChange={(e) => setDefEmp(e.target.value)}>
              <option value="">{t('common.select')}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="btn-secondary btn-sm whitespace-nowrap" disabled={!defEmp} onClick={() => setRows((rs) => rs.map((r) => ({ ...r, assignee_id: defEmp })))}>{t('assign.applyToAll')}</button>
          </div>
        </div>
        <div>
          <label className="label">{t('assign.defaultProject')}</label>
          <div className="flex gap-2">
            <select className="input" value={defProj} onChange={(e) => setDefProj(e.target.value)}>
              <option value="">{t('common.noProject')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="btn-secondary btn-sm whitespace-nowrap" disabled={!defProj} onClick={() => setRows((rs) => rs.map((r) => ({ ...r, project_id: defProj })))}>{t('assign.applyToAll')}</button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-900">{t('assign.rows')}</h2>
        <span className="text-sm text-ink-500">{t('assign.summary', { n: rows.length, e: employees })}</span>
      </div>

      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-brand-700">{t('assign.rowN', { n: i + 1 })}</span>
              <div className="flex gap-1">
                <button type="button" className="btn-ghost btn-sm" onClick={() => dup(r)}>{t('assign.duplicateRow')}</button>
                <button type="button" className="btn-ghost btn-sm text-red-600" disabled={rows.length === 1} onClick={() => remove(r.key)}>{t('assign.removeRow')}</button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-5"><label className="label">{t('tasks.taskTitle')} *</label>
                <input className={`input ${err(errors[i].title)}`} value={r.title} onChange={(e) => upd(r.key, 'title', e.target.value)} /></div>
              <div className="md:col-span-4"><label className="label">{t('tasks.assignee')}</label>
                <select className="input" value={r.assignee_id} onChange={(e) => upd(r.key, 'assignee_id', e.target.value)}>
                  <option value="">{t('assign.leaveUnassigned')}</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.dept ? ` — ${p.dept}` : ''}</option>)}
                </select></div>
              <div className="md:col-span-3"><label className="label">{t('tasks.priority')}</label>
                <select className="input" value={r.priority} onChange={(e) => upd(r.key, 'priority', e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
                </select></div>
              <div className="md:col-span-5"><label className="label">{t('tasks.description')}</label>
                <textarea rows={1} className="input" value={r.description} onChange={(e) => upd(r.key, 'description', e.target.value)} /></div>
              <div className="md:col-span-2"><label className="label">{t('tasks.startDate')}</label>
                <input type="date" className={`input ${err(errors[i].order)}`} value={r.start_date} onChange={(e) => upd(r.key, 'start_date', e.target.value)} /></div>
              <div className="md:col-span-2"><label className="label">{t('tasks.deadline')} *</label>
                <input type="date" className={`input ${err(errors[i].deadline || errors[i].order)}`} min={r.start_date || undefined} value={r.deadline} onChange={(e) => upd(r.key, 'deadline', e.target.value)} /></div>
              <div className="md:col-span-3"><label className="label">{t('tasks.project')}</label>
                <select className="input" value={r.project_id} onChange={(e) => upd(r.key, 'project_id', e.target.value)}>
                  <option value="">{t('common.noProject')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <label className="flex items-center gap-2 text-sm text-ink-700 md:col-span-12">
                <input type="checkbox" checked={r.requires_review} onChange={(e) => upd(r.key, 'requires_review', e.target.checked)} /> {t('assign.reviewToggle')}
              </label>
            </div>
            {touched && errors[i].order && <p className="mt-2 text-xs text-red-600">{t('err.row_start_after_deadline', { row: i + 1 })}</p>}
          </li>
        ))}
      </ol>

      <button type="button" className="btn-secondary w-full border-dashed py-3" onClick={add}>+ {t('assign.addRow')}</button>
      <p className="text-xs text-ink-500">{t('assign.pasteHint')}</p>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <span className="text-sm text-ink-600">{t('assign.summary', { n: rows.length, e: employees })}</span>
        <button className="btn-primary" disabled={pending} onClick={() => { setTouched(true); if (valid) setConfirm(true); }}>{pending ? t('assign.saving') : t('assign.save')}</button>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('assign.save')} footer={<>
        <button className="btn-secondary" onClick={() => setConfirm(false)}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={pending} onClick={save}>{t('common.confirm')}</button>
      </>}>
        <p className="text-sm text-ink-700">{t('assign.confirmSave', { n: rows.length })}</p>
        <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto text-sm">
          {rows.map((r, i) => <li key={r.key} className="flex justify-between gap-2"><span>{i + 1}. {r.title}</span><span className="text-ink-500">{people.find((p) => p.id === r.assignee_id)?.name ?? t('common.unassigned')}</span></li>)}
        </ul>
      </Modal>
    </div>
  );
}
