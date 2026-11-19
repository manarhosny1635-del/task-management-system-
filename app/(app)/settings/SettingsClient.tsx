'use client';
import { useState } from 'react';
import { t } from '@/lib/i18n/t';
import { createMemberLogin, saveDepartment, saveProfile, saveSetting, setMemberPermission, setRolePermission } from '@/lib/actions';
import { useAction } from '@/components/useAction';
import { Modal } from '@/components/Modal';
import type { Department, Profile } from '@/lib/types';

interface Opt { id: string; name: string }

export function MemberEditor({ member, departments, perms, overrides }:
  { member?: Profile; departments: Opt[]; perms: { key: string; label_ar: string }[]; overrides: { permission: string; granted: boolean }[] }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    full_name: member?.full_name ?? '', job_title: member?.job_title ?? '', phone: member?.phone ?? '', role: member?.role ?? 'employee',
    department_id: member?.department_id ?? '', max_active_tasks: member?.max_active_tasks ?? 5, is_active: member?.is_active ?? true,
  });
  const [login, setLogin] = useState({ email: member?.email ?? '', password: '' });
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const ov = (k: string) => overrides.find((o) => o.permission === k);

  async function save() {
    const res = await run(() => saveProfile(member?.id ?? null, f));
    if (res.ok) {
      const id = member?.id ?? (res.data as string);
      if (!member?.user_id && login.email && login.password) {
        const r2 = await run(() => createMemberLogin(id, login.email, login.password), t('settings.loginCreated'));
        if (!r2.ok) return;
      }
      setOpen(false);
    }
  }
  return (
    <>
      <button className={member ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'} onClick={() => setOpen(true)}>{member ? t('common.edit') : `+ ${t('settings.newMember')}`}</button>
      <Modal open={open} wide onClose={() => setOpen(false)} title={member ? t('settings.editMember') : t('settings.newMember')} footer={<>
        <button className="btn-secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={pending || !f.full_name.trim()} onClick={save}>{t('common.save')}</button>
      </>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">{t('common.name')} *</label><input className="input" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></div>
          <div><label className="label">{t('settings.jobTitle')}</label><input className="input" value={f.job_title} onChange={(e) => set('job_title', e.target.value)} /></div>
          <div><label className="label">{t('settings.phone')}</label><input className="input" dir="ltr" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className="label">{t('settings.role')}</label>
            <select className="input" value={f.role} onChange={(e) => set('role', e.target.value)}>{['employee', 'team_leader', 'admin'].map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}</select></div>
          <div><label className="label">{t('settings.department')}</label>
            <select className="input" value={f.department_id} onChange={(e) => set('department_id', e.target.value)}><option value="">{t('common.noDepartment')}</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="label">{t('team.capacity')}</label><input type="number" min={1} max={100} className="input" value={f.max_active_tasks} onChange={(e) => set('max_active_tasks', +e.target.value)} /></div>
          {member && <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} />{t('common.active')}</label>}
        </div>

        <div className="mt-5 rounded-lg border border-ink-200 p-3">
          <div className="mb-2 text-sm font-semibold">{member?.user_id ? `${t('settings.hasLogin')}: ${member.email}` : t('settings.createLogin')}</div>
          {!member?.user_id && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">{t('settings.loginEmail')}</label><input type="email" dir="ltr" className="input" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} /></div>
              <div><label className="label">{t('settings.tempPassword')}</label><input type="text" dir="ltr" className="input" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></div>
            </div>
          )}
        </div>

        {member && f.role !== 'admin' && (
          <div className="mt-5">
            <div className="mb-2 text-sm font-semibold">{t('settings.memberPerms')}</div>
            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
              {perms.map((p) => {
                const cur = ov(p.key);
                const val = cur ? (cur.granted ? 'grant' : 'deny') : 'inherit';
                return (
                  <li key={p.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>{p.label_ar}</span>
                    <select className="input w-auto py-1 text-xs" value={val} disabled={pending}
                      onChange={(e) => run(() => setMemberPermission(member.id, p.key, e.target.value === 'inherit' ? null : e.target.value === 'grant'), '')}>
                      <option value="inherit">{t('settings.inherit')}</option><option value="grant">{t('settings.grant')}</option><option value="deny">{t('settings.deny')}</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}

export function DepartmentEditor({ dept, people }: { dept?: Department; people: Opt[] }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: dept?.name ?? '', description: dept?.description ?? '', leader: dept?.leader_id ?? '' });
  return (
    <>
      <button className={dept ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'} onClick={() => setOpen(true)}>{dept ? t('common.edit') : `+ ${t('settings.newDepartment')}`}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={dept?.name ?? t('settings.newDepartment')} footer={<>
        <button className="btn-secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={pending || !f.name.trim()} onClick={async () => { if ((await run(() => saveDepartment(dept?.id ?? null, f.name, f.description, f.leader || null))).ok) setOpen(false); }}>{t('common.save')}</button>
      </>}>
        <div className="space-y-3">
          <div><label className="label">{t('settings.deptName')} *</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label">{t('common.description')}</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><label className="label">{t('settings.leader')}</label>
            <select className="input" value={f.leader} onChange={(e) => setF({ ...f, leader: e.target.value })}><option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
      </Modal>
    </>
  );
}

export function RolePermToggle({ role, perm, on }: { role: string; perm: string; on: boolean }) {
  const { run, pending } = useAction();
  return <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={on} disabled={pending} onChange={(e) => run(() => setRolePermission(role, perm, e.target.checked), '')} />;
}

export function GeneralSettings({ company, dueSoon }: { company: string; dueSoon: number }) {
  const { run, pending } = useAction();
  const [c, setC] = useState(company);
  const [d, setD] = useState(dueSoon);
  return (
    <div className="max-w-md space-y-3">
      <div><label className="label">{t('settings.companyName')}</label><input className="input" value={c} onChange={(e) => setC(e.target.value)} /></div>
      <div><label className="label">{t('settings.dueSoonDays')}</label><input type="number" min={0} max={30} className="input" value={d} onChange={(e) => setD(+e.target.value)} /></div>
      <button className="btn-primary" disabled={pending} onClick={async () => { await run(() => saveSetting('company_name', c), ''); await run(() => saveSetting('due_soon_days', d), t('common.saved')); }}>{t('common.save')}</button>
    </div>
  );
}
