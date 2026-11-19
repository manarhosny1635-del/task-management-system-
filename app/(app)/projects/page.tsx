import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { fetchLookups } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { Empty, PageHeader } from '@/components/ui';
import { ProjectEditor } from './ProjectEditor';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const s = await requireSession();
  const supabase = await createClient();
  const lk = await fetchLookups();
  const { data } = await supabase.from('task_overview').select('project_id,status,is_overdue').limit(5000);
  const tasks = data ?? [];
  const canEdit = s.can('projects.manage');
  const depts = lk.departments.map((d) => ({ id: d.id, name: d.name }));
  return (
    <div>
      <PageHeader title={t('projects.title')} actions={canEdit && <ProjectEditor departments={depts} />} />
      {!lk.projects.length ? <div className="card"><Empty /></div> : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-ink-200 bg-ink-50"><tr>
              <th className="th">{t('projects.name')}</th><th className="th">{t('tasks.department')}</th><th className="th">{t('common.status')}</th>
              <th className="th">{t('projects.tasks')}</th><th className="th">{t('projects.open')}</th><th className="th">{t('projects.done')}</th>
              <th className="th">{t('deadline.overdue')}</th><th className="th" />
            </tr></thead>
            <tbody className="divide-y divide-ink-100">
              {lk.projects.map((p) => {
                const mine = tasks.filter((x) => x.project_id === p.id && x.status !== 'cancelled');
                const done = mine.filter((x) => x.status === 'completed').length;
                return (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="td"><Link href={`/tasks?project=${p.id}`} className="font-medium text-ink-900 hover:text-brand-700">{p.name}</Link>
                      {p.description && <div className="text-xs text-ink-500">{p.description}</div>}</td>
                    <td className="td text-sm text-ink-600">{lk.departments.find((d) => d.id === p.department_id)?.name ?? '—'}</td>
                    <td className="td text-sm">{t(`projects.status.${p.status}`)}</td>
                    <td className="td tabular-nums">{mine.length}</td>
                    <td className="td tabular-nums">{mine.length - done}</td>
                    <td className="td tabular-nums text-green-700">{done}</td>
                    <td className="td tabular-nums text-red-600">{mine.filter((x) => x.is_overdue).length || ''}</td>
                    <td className="td text-end">{canEdit && <ProjectEditor departments={depts} project={p} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
