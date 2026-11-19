'use client';
import { useState } from 'react';
import { t } from '@/lib/i18n/t';
import { Modal } from '../Modal';
import { useAction } from '../useAction';
import { assignTask, requestExtension, respondToAssignment, transitionTask, updateProgress, updateTask } from '@/lib/actions';
import type { TaskRow, Priority } from '@/lib/types';
import { PRIORITIES } from '@/lib/constants';
import { fmtDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { registerAttachment } from '@/lib/actions';

export interface Perms { isOwner: boolean; canManage: boolean; canReview: boolean; canChangeDeadline: boolean }
interface Opt { id: string; name: string }

type Dialog =
  | { kind: 'confirm'; title: string; text: string; action: string; danger?: boolean }
  | { kind: 'reason'; title: string; placeholder: string; action: string; required: boolean; danger?: boolean }
  | { kind: 'reassign' } | { kind: 'extension' } | { kind: 'edit' } | { kind: 'progress' } | null;

export function TaskActions({ task, perms, people, projects, departments, minDate }:
  { task: TaskRow; perms: Perms; people: Opt[]; projects: Opt[]; departments: Opt[]; minDate: string }) {
  const { run, pending } = useAction();
  const [dlg, setDlg] = useState<Dialog>(null);
  const [text, setText] = useState('');
  const close = () => { setDlg(null); setText(''); };
  const st = task.status;
  const { isOwner, canManage, canReview } = perms;

  async function exec(action: string, note?: string) {
    const res = action === 'accept' ? await run(() => respondToAssignment(task.id, true))
      : action === 'reject' ? await run(() => respondToAssignment(task.id, false, note))
      : await run(() => transitionTask(task.id, action, note));
    if (res.ok) close();
  }

  const buttons: { label: string; cls: string; onClick: () => void }[] = [];
  if (isOwner && st === 'pending_acceptance') {
    buttons.push({ label: t('actions.accept'), cls: 'btn-success', onClick: () => setDlg({ kind: 'confirm', title: t('actions.accept'), text: t('actions.confirmAccept'), action: 'accept' }) });
    buttons.push({ label: t('actions.reject'), cls: 'btn-danger', onClick: () => setDlg({ kind: 'reason', title: t('actions.reject'), placeholder: t('actions.rejectReasonPh'), action: 'reject', required: true, danger: true }) });
  }
  if (isOwner && (st === 'accepted' || st === 'changes_requested')) buttons.push({ label: t('actions.start'), cls: 'btn-primary', onClick: () => exec('start') });
  if (isOwner && ['in_progress', 'changes_requested', 'on_hold'].includes(st)) buttons.push({ label: t('tasks.updateProgress'), cls: 'btn-secondary', onClick: () => setDlg({ kind: 'progress' }) });
  if (isOwner && (st === 'in_progress' || st === 'changes_requested'))
    buttons.push({ label: task.requires_review ? t('actions.submit') : t('actions.submitDone'), cls: 'btn-primary', onClick: () => setDlg({ kind: 'reason', title: t('actions.submit'), placeholder: t('actions.notePh'), action: 'submit', required: false }) });
  if ((isOwner || canManage) && ['accepted', 'in_progress', 'changes_requested'].includes(st))
    buttons.push({ label: t('actions.hold'), cls: 'btn-secondary', onClick: () => setDlg({ kind: 'reason', title: t('actions.hold'), placeholder: t('actions.holdReasonPh'), action: 'hold', required: true }) });
  if ((isOwner || canManage) && st === 'on_hold') buttons.push({ label: t('actions.resume'), cls: 'btn-primary', onClick: () => exec('resume') });
  if (canReview && st === 'submitted') {
    buttons.push({ label: t('actions.approve'), cls: 'btn-success', onClick: () => setDlg({ kind: 'confirm', title: t('actions.approve'), text: t('actions.confirmApprove'), action: 'approve' }) });
    buttons.push({ label: t('actions.requestChanges'), cls: 'btn-secondary', onClick: () => setDlg({ kind: 'reason', title: t('actions.requestChanges'), placeholder: t('actions.changesPh'), action: 'request_changes', required: true }) });
  }
  if (isOwner && ['accepted', 'in_progress', 'on_hold', 'changes_requested', 'submitted'].includes(st) && task.current_deadline && !task.has_pending_extension)
    buttons.push({ label: t('actions.requestExtension'), cls: 'btn-secondary', onClick: () => setDlg({ kind: 'extension' }) });
  if (canManage && !['completed', 'cancelled'].includes(st)) {
    buttons.push({ label: task.assignee_id ? t('actions.reassign') : t('actions.assign'), cls: st === 'new' || st === 'declined' ? 'btn-primary' : 'btn-secondary', onClick: () => setDlg({ kind: 'reassign' }) });
    buttons.push({ label: t('common.edit'), cls: 'btn-secondary', onClick: () => setDlg({ kind: 'edit' }) });
    buttons.push({ label: t('actions.cancel'), cls: 'btn-ghost text-red-600', onClick: () => setDlg({ kind: 'reason', title: t('actions.cancel'), placeholder: t('actions.cancelPh'), action: 'cancel', required: true, danger: true }) });
  }

  if (!buttons.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">{buttons.map((b) => <button key={b.label} className={b.cls} disabled={pending} onClick={b.onClick}>{b.label}</button>)}</div>

      {dlg?.kind === 'confirm' && (
        <Modal open title={dlg.title} onClose={close} footer={<>
          <button className="btn-secondary" onClick={close}>{t('common.cancel')}</button>
          <button className={dlg.danger ? 'btn-danger' : 'btn-primary'} disabled={pending} onClick={() => exec(dlg.action)}>{t('common.yesConfirm')}</button>
        </>}><p className="text-sm text-ink-700">{dlg.text}</p></Modal>
      )}
      {dlg?.kind === 'reason' && (
        <Modal open title={dlg.title} onClose={close} footer={<>
          <button className="btn-secondary" onClick={close}>{t('common.cancel')}</button>
          <button className={dlg.danger ? 'btn-danger' : 'btn-primary'} disabled={pending || (dlg.required && text.trim().length < 3)} onClick={() => exec(dlg.action, text)}>{t('common.confirm')}</button>
        </>}>
          {dlg.action === 'reject' && <p className="mb-3 text-sm text-ink-600">{t('actions.confirmReject')}</p>}
          {dlg.action === 'submit' && <p className="mb-3 text-sm text-ink-600">{t('actions.confirmSubmit')}</p>}
          {dlg.action === 'cancel' && <p className="mb-3 text-sm text-ink-600">{t('actions.confirmCancel')}</p>}
          <textarea autoFocus rows={4} className="input" placeholder={dlg.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        </Modal>
      )}
      {dlg?.kind === 'reassign' && <ReassignDialog task={task} people={people} onClose={close} />}
      {dlg?.kind === 'extension' && <ExtensionDialog task={task} minDate={minDate} onClose={close} />}
      {dlg?.kind === 'progress' && <ProgressDialog task={task} onClose={close} />}
      {dlg?.kind === 'edit' && <EditDialog task={task} projects={projects} departments={departments} canChangeDeadline={perms.canChangeDeadline} onClose={close} />}
    </>
  );
}

function ReassignDialog({ task, people, onClose }: { task: TaskRow; people: Opt[]; onClose: () => void }) {
  const { run, pending } = useAction();
  const [to, setTo] = useState(task.suggested_assignee_id ?? '');
  const [note, setNote] = useState('');
  return (
    <Modal open title={task.assignee_id ? t('actions.reassign') : t('actions.assign')} onClose={onClose} footer={<>
      <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={!to || pending} onClick={async () => { if ((await run(() => assignTask(task.id, to, note))).ok) onClose(); }}>{t('common.confirm')}</button>
    </>}>
      {task.assignee_name && <p className="mb-3 text-sm text-ink-600">{t('tasks.previousOwner')}: <b>{task.assignee_name}</b></p>}
      <label className="label">{t('actions.reassignTo')}</label>
      <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">{t('actions.chooseEmployee')}</option>
        {people.filter((p) => p.id !== task.assignee_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <label className="label mt-3">{t('actions.reassignNote')}</label>
      <textarea rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}

function ExtensionDialog({ task, minDate, onClose }: { task: TaskRow; minDate: string; onClose: () => void }) {
  const { run, pending } = useAction();
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const min = task.current_deadline && task.current_deadline >= minDate ? nextDay(task.current_deadline) : nextDay(minDate);
  async function submit() {
    const res = await run(() => requestExtension(task.id, date, reason, notes), t('ext.submitted'));
    if (res.ok && file && res.data) await uploadFile(task.id, file, res.data as string);
    if (res.ok) onClose();
  }
  return (
    <Modal open wide title={t('ext.request')} onClose={onClose} footer={<>
      <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={pending || !date || reason.trim().length < 5} onClick={submit}>{t('common.submit')}</button>
    </>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><div className="label">{t('tasks.code')}</div><div className="input bg-ink-50">{task.code}</div></div>
        <div className="sm:col-span-2"><div className="label">{t('tasks.taskTitle')}</div><div className="input truncate bg-ink-50">{task.title}</div></div>
        <div><div className="label">{t('tasks.originalDeadline')}</div><div className="input bg-ink-50">{fmtDate(task.original_deadline)}</div></div>
        <div><div className="label">{t('ext.currentDeadline')}</div><div className="input bg-ink-50">{fmtDate(task.current_deadline)}</div></div>
        <div><label className="label">{t('ext.requested')} *</label><input type="date" min={min} className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <label className="label mt-3">{t('ext.reason')} *</label>
      <textarea rows={4} className="input" placeholder={t('ext.reasonPh')} value={reason} onChange={(e) => setReason(e.target.value)} />
      <label className="label mt-3">{t('ext.notes')} ({t('common.optional')})</label>
      <textarea rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <label className="label mt-3">{t('ext.attachment')} ({t('common.optional')})</label>
      <input type="file" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    </Modal>
  );
}

function ProgressDialog({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const { run, pending } = useAction();
  const [v, setV] = useState(task.progress);
  const [note, setNote] = useState('');
  return (
    <Modal open title={t('tasks.updateProgress')} onClose={onClose} footer={<>
      <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={pending} onClick={async () => { if ((await run(() => updateProgress(task.id, v, note))).ok) onClose(); }}>{t('common.save')}</button>
    </>}>
      <div className="flex items-center gap-3">
        <input type="range" min={0} max={100} step={5} value={v} onChange={(e) => setV(+e.target.value)} className="flex-1 accent-brand-600" />
        <span className="w-12 text-end font-semibold tabular-nums">{v}%</span>
      </div>
      <label className="label mt-3">{t('tasks.progressNote')}</label>
      <textarea rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}

function EditDialog({ task, projects, departments, canChangeDeadline, onClose }:
  { task: TaskRow; projects: Opt[]; departments: Opt[]; canChangeDeadline: boolean; onClose: () => void }) {
  const { run, pending } = useAction();
  const [f, setF] = useState({
    title: task.title, description: task.description ?? '', priority: task.priority, project_id: task.project_id ?? '',
    department_id: task.department_id ?? '', start_date: task.start_date ?? '', requires_review: task.requires_review, deadline: task.current_deadline ?? '',
  });
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  async function save() {
    const patch: Record<string, unknown> = { ...f };
    if (!canChangeDeadline || f.deadline === (task.current_deadline ?? '')) delete patch.deadline;
    if ((await run(() => updateTask(task.id, patch))).ok) onClose();
  }
  return (
    <Modal open wide title={t('tasks.editTask')} onClose={onClose} footer={<>
      <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={pending || !f.title.trim()} onClick={save}>{t('common.save')}</button>
    </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label">{t('tasks.taskTitle')} *</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">{t('tasks.description')}</label><textarea rows={3} className="input" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div><label className="label">{t('tasks.priority')}</label>
          <select className="input" value={f.priority} onChange={(e) => set('priority', e.target.value as Priority)}>{PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}</select></div>
        <div><label className="label">{t('tasks.project')}</label>
          <select className="input" value={f.project_id} onChange={(e) => set('project_id', e.target.value)}><option value="">{t('common.noProject')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="label">{t('tasks.department')}</label>
          <select className="input" value={f.department_id} onChange={(e) => set('department_id', e.target.value)}><option value="">{t('common.noDepartment')}</option>{departments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="label">{t('tasks.startDate')}</label><input type="date" className="input" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} /></div>
        <div><label className="label">{t('tasks.currentDeadline')}</label>
          <input type="date" className="input" disabled={!canChangeDeadline} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
          {!canChangeDeadline && <p className="mt-1 text-xs text-ink-500">{t('err.deadline_change_not_allowed')}</p>}</div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={f.requires_review} onChange={(e) => set('requires_review', e.target.checked)} />{t('tasks.requiresReview')}</label>
      </div>
    </Modal>
  );
}

function nextDay(d: string) { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); }

export async function uploadFile(taskId: string, file: File, extId: string | null = null) {
  const supabase = createClient();
  const safe = file.name.replace(/[^\w.\-؀-ۿ]+/g, '_').slice(-80);
  const path = `tasks/${taskId}/${crypto.randomUUID()}-${safe}`;
  const up = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type || undefined });
  if (up.error) return { ok: false as const, error: 'err.upload_failed' };
  return registerAttachment(taskId, extId, { name: file.name, path, type: file.type, size: file.size });
}
