'use client';
import { useState } from 'react';
import { t } from '@/lib/i18n/t';
import { saveProject } from '@/lib/actions';
import { useAction } from '@/components/useAction';
import { Modal } from '@/components/Modal';
import type { Project } from '@/lib/types';

export function ProjectEditor({ project, departments }: { project?: Project; departments: { id: string; name: string }[] }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: project?.name ?? '', description: project?.description ?? '', department_id: project?.department_id ?? '', status: project?.status ?? 'active' });
  return (
    <>
      <button className={project ? 'btn-ghost btn-sm' : 'btn-primary'} onClick={() => setOpen(true)}>{project ? t('common.edit') : `+ ${t('projects.new')}`}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={project ? project.name : t('projects.new')} footer={<>
        <button className="btn-secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={pending || !f.name.trim()} onClick={async () => {
          if ((await run(() => saveProject(project?.id ?? null, f.name, f.description, f.department_id || null, f.status))).ok) setOpen(false);
        }}>{t('common.save')}</button>
      </>}>
        <div className="space-y-3">
          <div><label className="label">{t('projects.name')} *</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label">{t('common.description')}</label><textarea rows={2} className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><label className="label">{t('tasks.department')}</label>
            <select className="input" value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}>
              <option value="">{t('common.noDepartment')}</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="label">{t('common.status')}</label>
            <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {['active', 'on_hold', 'completed', 'archived'].map((s) => <option key={s} value={s}>{t(`projects.status.${s}`)}</option>)}
            </select></div>
        </div>
      </Modal>
    </>
  );
}
