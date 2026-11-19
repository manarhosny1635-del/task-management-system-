'use client';
import { t } from '@/lib/i18n/t';

export type Sheet = { name: string; rows: Record<string, string | number | null>[] };

export async function downloadXlsx(filename: string, sheets: Sheet[]) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  sheets.forEach((s) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}]), s.name.slice(0, 31)));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
}
export async function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const XLSX = await import('xlsx');
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename.endsWith('.csv') ? filename : filename + '.csv'; a.click();
  URL.revokeObjectURL(a.href);
}

export function ExportButtons({ filename, sheets }: { filename: string; sheets: Sheet[] }) {
  return (
    <div className="inline-flex gap-2">
      <button className="btn-secondary btn-sm" onClick={() => downloadXlsx(filename, sheets)}>{t('common.exportExcel')}</button>
      <button className="btn-secondary btn-sm" onClick={() => downloadCsv(filename, sheets[0]?.rows ?? [])}>{t('common.exportCsv')}</button>
    </div>
  );
}
