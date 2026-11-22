'use client';
import { useRef, useState } from 'react';
import { t } from '@/lib/i18n/t';
import { addComment, getAttachmentUrl } from '@/lib/actions';
import { useAction } from '../useAction';
import { uploadFile } from './TaskActions';
import { fmtDateTime } from '@/lib/format';
import { Avatar, Empty } from '../ui';

export interface CommentItem { id: string; author: string; kind: string; body: string; created_at: string }
export interface AttachmentItem { id: string; file_name: string; storage_path: string; size_bytes: number | null; uploader: string; created_at: string; ext: boolean }

export function Comments({ taskId, items, canWrite }: { taskId: string; items: CommentItem[]; canWrite: boolean }) {
  const { run, pending } = useAction();
  const [body, setBody] = useState('');
  return (
    <div>
      {canWrite && (
        <div className="mb-4 flex gap-2">
          <textarea rows={2} className="input" placeholder={t('tasks.addComment')} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn-primary self-end" disabled={pending || !body.trim()} onClick={async () => { if ((await run(() => addComment(taskId, body), '')).ok) setBody(''); }}>{t('tasks.send')}</button>
        </div>
      )}
      {!items.length ? <Empty text={t('tasks.noComments')} /> : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author} />
              <div className={`min-w-0 flex-1 rounded-lg px-3 py-2 ${c.kind === 'progress' ? 'bg-brand-100' : c.kind === 'note' ? 'bg-amber-50' : 'bg-ink-50'}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span className="font-semibold text-ink-800">{c.author}</span>
                  {c.kind !== 'comment' && <span className="badge bg-white text-ink-600 ring-ink-200">{c.kind === 'progress' ? t('tasks.progress') : t('common.notes')}</span>}
                  <span>{fmtDateTime(c.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Attachments({ taskId, items, canUpload }: { taskId: string; items: AttachmentItem[]; canUpload: boolean }) {
  const { run, pending } = useAction();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function open(path: string) {
    const r = await getAttachmentUrl(path);
    if (r.ok && r.data) window.open(r.data, '_blank', 'noopener');
  }
  return (
    <div>
      {canUpload && (
        <>
          <input ref={ref} type="file" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setBusy(true); await run(() => uploadFile(taskId, f), ''); setBusy(false); e.target.value = '';
          }} />
          <button className="btn-secondary btn-sm mb-3" disabled={busy || pending} onClick={() => ref.current?.click()}>{busy ? t('tasks.uploading') : `+ ${t('tasks.upload')}`}</button>
        </>
      )}
      {!items.length ? <p className="text-sm text-ink-500">{t('tasks.noAttachments')}</p> : (
        <ul className="divide-y divide-ink-100">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg>
              <button className="min-w-0 truncate text-start font-medium text-brand-700 hover:underline" onClick={() => open(a.storage_path)}>{a.file_name}</button>
              {a.ext && <span className="badge bg-amber-50 text-amber-800 ring-amber-200">{t('ext.attachment')}</span>}
              <span className="ms-auto whitespace-nowrap text-xs text-ink-500">{a.uploader} · {fmtDateTime(a.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
