import { requireSession } from '@/lib/session';
import { fetchLookups, sp, type SearchParams } from '@/lib/queries';
import { t } from '@/lib/i18n/t';
import { PageHeader } from '@/components/ui';
import { BatchForm } from './BatchForm';

export default async function AssignPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const s = await requireSession('tasks.create');
  const params = await searchParams;
  const lk = await fetchLookups();
  const people = lk.people.filter((p) => p.is_active && (s.profile.role === 'admin' || p.department_id === s.profile.department_id || p.id === s.profile.id));
  return (
    <div>
      <PageHeader title={t('assign.title')} subtitle={t('assign.subtitle')} />
      <BatchForm
        people={people.map((p) => ({ id: p.id, name: p.full_name, dept: lk.departments.find((d) => d.id === p.department_id)?.name ?? '' }))}
        projects={lk.projects.filter((p) => p.status === 'active').map((p) => ({ id: p.id, name: p.name }))}
        defaultEmployee={sp(params, 'employee')} />
    </div>
  );
}
