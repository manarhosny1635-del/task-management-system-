'use client';
import { useState } from 'react';
import { t } from '@/lib/i18n/t';
import { decideExtension, withdrawExtension } from '@/lib/actions';
import { useAction } from '../useAction';
import { Modal } from '../Modal';
import { fmtDate } from '@/lib/format';

export function ExtDecision({ id, requested, canDecide, canWithdraw }: { id: string; requested: string; canDecide: boolean; canWithdraw: boolean }) {
  const { run, pending } = useAction();
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [text, setText] = useState('');
  const close = () => { setMode(null); setText(''); };
  return (
    <div className="flex flex-wrap gap-2">
      {canDecide && <>
        <button className="btn-success btn-sm" disabled={pending} onClick={() => setMode('approve')}>{t('ext.approve')}</button>
        <button className="btn-danger btn-sm" disabled={pending} onClick={() => setMode('reject')}>{t('ext.reject')}</button>
      </>}
      {canWithdraw && <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run(() => withdrawExtension(id))}>{t('ext.withdraw')}</button>}
      {mode && (
        <Modal open title={mode === 'approve' ? t('ext.approve') : t('ext.reject')} onClose={close} footer={<>
          <button className="btn-secondary" onClick={close}>{t('common.cancel')}</button>
          <button className={mode === 'approve' ? 'btn-success' : 'btn-danger'} disabled={pending || (mode === 'reject' && text.trim().length < 3)}
            onClick={async () => { if ((await run(() => decideExtension(id, mode === 'approve', text))).ok) close(); }}>{t('common.confirm')}</button>
        </>}>
          {mode === 'approve' && <p className="mb-3 text-sm text-ink-700">{t('ext.approveConfirm', { d: fmtDate(requested) })}</p>}
          <textarea rows={3} className="input" placeholder={mode === 'approve' ? t('ext.approveNote') : t('ext.rejectReason')} value={text} onChange={(e) => setText(e.target.value)} />
        </Modal>
      )}
    </div>
  );
}
