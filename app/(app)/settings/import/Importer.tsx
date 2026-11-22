'use client';
import { useState } from 'react';
import { t } from '@/lib/i18n/t';
import { buildPreview, toPayload, FIELD_LABELS, type Preview, type PreviewCell } from '@/lib/sheetImport';
import { importSheet } from '@/lib/actions';
import { useAction } from '@/components/useAction';
import { Card } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { fmtDate } from '@/lib/format';

type Summary = { employees_created: number; employees_existing: number; tasks_created: number; tasks_duplicate: number; errors: { row: number; error: string; name?: string; title?: string }[] };

const KIND_CLS = { current: 'bg-brand-100 text-brand-800 ring-brand-300', queued: 'bg-sand-100 text-sand-700 ring-sand-200', finished: 'bg-green-50 text-green-700 ring-green-200' };

export function Importer({ bundled }: { bundled: string | null }) {
  const { run, pending } = useAction();
  const [year, setYear] = useState(new Date().getFullYear());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [source, setSource] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [raw, setRaw] = useState<unknown[][] | null>(null);

  async function load(data: ArrayBuffer | string, name: string) {
    const XLSX = await import('xlsx');
    const wb = typeof data === 'string' ? XLSX.read(data, { type: 'string', raw: true }) : XLSX.read(data, { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
    setRaw(rows); setSource(name); setResult(null); setPreview(buildPreview(rows, year));
  }
  const updCell = (id: string, fn: (c: PreviewCell) => PreviewCell) => setPreview((p) => p && { ...p, cells: p.cells.map((c) => (c.id === id ? fn(c) : c)) });
  const payload = preview ? toPayload(preview, source) : null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="btn-primary cursor-pointer">
            {t('importer.upload')}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await load(await f.arrayBuffer(), f.name); }} />
          </label>
          {bundled && <button className="btn-secondary" onClick={() => load(bundled, 'متابعة تاسكات (Google Sheet)')}>{t('importer.useBundled')}</button>}
          <div>
            <label className="label">{t('importer.yearNote', { y: year })}</label>
            <input type="number" className="input w-28" value={year} onChange={(e) => { const y = +e.target.value; setYear(y); if (raw) setPreview(buildPreview(raw, y)); }} />
          </div>
        </div>
      </Card>

      {preview && payload && (
        <>
          <Card title={t('importer.mapping')} bodyClass="p-0">
            <table className="w-full text-sm"><thead className="bg-ink-50"><tr><th className="th">{t('importer.column')}</th><th className="th">{t('importer.field')}</th></tr></thead>
              <tbody className="divide-y divide-ink-100">{preview.mapping.map((m) => <tr key={m.index}><td className="td" dir="auto">{m.column}</td><td className="td">{FIELD_LABELS[m.field]}</td></tr>)}</tbody></table>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4"><div className="text-xs text-ink-500">{t('importer.employees')}</div><div className="text-2xl font-bold">{preview.employees.length}</div></div>
            <div className="card p-4"><div className="text-xs text-ink-500">{t('importer.tasks')}</div><div className="text-2xl font-bold">{payload.tasks.length}</div></div>
            <div className="card p-4"><div className="text-xs text-ink-500">{t('importer.noDeadline')}</div><div className="text-2xl font-bold text-amber-600">{preview.cells.filter((c) => c.kind === 'current' && !c.deadline).length}</div></div>
            <div className="card p-4"><div className="text-xs text-ink-500">{t('importer.issues')}</div><div className="text-2xl font-bold text-amber-600">{preview.employees.filter((e) => e.issues.length).length}</div></div>
          </div>

          <Card title={t('importer.preview')} bodyClass="p-0">
            <ul className="divide-y divide-ink-100">
              {preview.employees.map((e) => {
                const cells = preview.cells.filter((c) => c.row === e.row);
                return (
                  <li key={e.row} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-ink-400">{t('importer.row')} {e.row}</span>
                      <span className="font-semibold text-ink-900">{e.name}</span>
                      {e.issues.map((i) => <span key={i} className="badge bg-amber-50 text-amber-800 ring-amber-200">{i}</span>)}
                    </div>
                    {!cells.length && <p className="mt-1 text-xs text-ink-500">{t('importer.noTasks')}</p>}
                    <div className="mt-2 space-y-2">
                      {cells.map((c) => (
                        <div key={c.id} className="rounded-lg border border-ink-100 bg-ink-50/50 p-2">
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className={`badge ${KIND_CLS[c.kind]}`}>{t(`importer.kind.${c.kind}`)}</span>
                            <span className="text-ink-500">{t(`status.${c.status}`)}</span>
                            {c.deadline && <span className="text-ink-500">· {t('tasks.deadline')}: {fmtDate(c.deadline)}</span>}
                            {c.assignment_date && <span className="text-ink-500">· {t('tasks.assignedAt')}: {fmtDate(c.assignment_date)}</span>}
                            {c.items.length > 1 && (
                              <button className="btn-ghost btn-sm ms-auto" onClick={() => updCell(c.id, (x) => ({ ...x, split: !x.split }))}>
                                {c.split ? t('importer.merge') : t('importer.split')}
                              </button>
                            )}
                          </div>
                          {(c.split ? c.items : [{ id: c.id + '-m', title: c.raw, include: c.items.some((i) => i.include), duplicateOf: undefined }]).map((it) => (
                            <label key={it.id} className="flex items-center gap-2 py-0.5 text-sm">
                              <input type="checkbox" checked={it.include} onChange={(ev) => updCell(c.id, (x) => ({
                                ...x, items: x.split ? x.items.map((i) => (i.id === it.id ? { ...i, include: ev.target.checked } : i)) : x.items.map((i) => ({ ...i, include: ev.target.checked })),
                              }))} />
                              {c.split ? (
                                <input className="input py-1" value={it.title} onChange={(ev) => updCell(c.id, (x) => ({ ...x, items: x.items.map((i) => (i.id === it.id ? { ...i, title: ev.target.value } : i)) }))} />
                              ) : <span>{it.title}</span>}
                              {it.duplicateOf && <span className="whitespace-nowrap text-xs text-ink-500">= {it.duplicateOf}</span>}
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-ink-200 bg-white/95 px-4 py-3 sm:-mx-6 sm:px-6">
            <span className="self-center text-sm text-ink-600">{preview.employees.length} {t('importer.employees')} · {payload.tasks.length} {t('importer.tasks')}</span>
            <button className="btn-primary" disabled={pending} onClick={() => setConfirm(true)}>{t('importer.run')}</button>
          </div>
        </>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('importer.run')} footer={<>
        <button className="btn-secondary" onClick={() => setConfirm(false)}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={pending} onClick={async () => {
          const r = await run(() => importSheet(payload), '');
          setConfirm(false);
          if (r.ok) setResult(r.data as unknown as Summary);
        }}>{pending ? t('importer.running') : t('common.confirm')}</button>
      </>}>
        <p className="text-sm text-ink-700">{preview?.employees.length} {t('importer.employees')} · {payload?.tasks.length} {t('importer.tasks')}</p>
      </Modal>

      {result && (
        <Card title={t('importer.summary')}>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-ink-500">{t('importer.employees')} — {t('importer.created')}</dt><dd className="text-xl font-bold">{result.employees_created}</dd></div>
            <div><dt className="text-ink-500">{t('importer.employees')} — {t('importer.existing')}</dt><dd className="text-xl font-bold">{result.employees_existing}</dd></div>
            <div><dt className="text-ink-500">{t('importer.tasksCreated')}</dt><dd className="text-xl font-bold text-green-700">{result.tasks_created}</dd></div>
            <div><dt className="text-ink-500">{t('importer.duplicates')}</dt><dd className="text-xl font-bold">{result.tasks_duplicate}</dd></div>
          </dl>
          {!!result.errors.length && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-rose-700">{t('importer.errors')} ({result.errors.length})</h3>
              <ul className="space-y-1 text-sm">{result.errors.map((e, i) => <li key={i} className="rounded bg-rose-50 px-2 py-1 text-rose-700">{t('importer.row')} {e.row}: {e.error} {e.name ?? e.title ?? ''}</li>)}</ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
