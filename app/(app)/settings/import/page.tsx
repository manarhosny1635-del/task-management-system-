import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/t';
import { PageHeader, Card } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { Importer } from './Importer';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  await requireSession('import.run');
  const supabase = await createClient();
  const { data: runs } = await supabase.from('import_runs').select('*').order('created_at', { ascending: false }).limit(10);
  let bundled: string | null = null;
  try { bundled = await readFile(path.join(process.cwd(), 'data', 'sheet-export.csv'), 'utf8'); } catch { /* not bundled */ }
  return (
    <div>
      <div className="mb-4 text-sm"><Link href="/settings" className="text-brand-600 hover:underline">← {t('settings.title')}</Link></div>
      <PageHeader title={t('importer.title')} subtitle={t('importer.subtitle')} />
      <Importer bundled={bundled} />
      {!!runs?.length && (
        <Card title={t('importer.history')} className="mt-6" bodyClass="p-0">
          <ul className="divide-y divide-ink-100 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="font-medium">{r.source_name}</span><span className="text-ink-500">{fmtDateTime(r.created_at)}</span>
                <span>{t('importer.tasksCreated')}: {r.summary.tasks_created}</span><span>{t('importer.duplicates')}: {r.summary.tasks_duplicate}</span>
                <span className={r.summary.errors ? 'text-red-600' : ''}>{t('importer.errors')}: {r.summary.errors}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
