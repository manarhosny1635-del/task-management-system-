-- =====================================================================
-- 0003: Integrity triggers, read views, Row Level Security, grants, seed
-- =====================================================================

-- ---------- Integrity triggers (apply even to the service role) -------
create or replace function public.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception 'err.audit_immutable' using errcode = 'P0001';
end $$;

create trigger activity_log_no_update   before update or delete on public.activity_log      for each row execute function public.forbid_change();
create trigger activity_log_no_truncate before truncate          on public.activity_log      for each statement execute function public.forbid_change();
create trigger comments_no_change       before update or delete on public.task_comments     for each row execute function public.forbid_change();
create trigger assignments_no_delete    before delete           on public.task_assignments  for each row execute function public.forbid_change();
create trigger extensions_no_delete     before delete           on public.extension_requests for each row execute function public.forbid_change();
create trigger tasks_no_delete          before delete           on public.tasks             for each row execute function public.forbid_change();

-- original deadline is permanent; finished tasks are frozen
create or replace function public.guard_task_update() returns trigger
language plpgsql as $$
begin
  if old.original_deadline is not null and new.original_deadline is distinct from old.original_deadline then
    raise exception 'err.original_deadline_immutable' using errcode = 'P0001';
  end if;
  if old.status in ('completed', 'cancelled')
     and (new.status, new.title, new.description, new.assignee_id, new.current_deadline, new.priority, new.progress)
         is distinct from
         (old.status, old.title, old.description, old.assignee_id, old.current_deadline, old.priority, old.progress) then
    raise exception 'err.task_locked' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger tasks_guard before update on public.tasks for each row execute function public.guard_task_update();

-- ---------- Read views (security_invoker → RLS of the caller applies) --
create view public.task_overview with (security_invoker = true) as
select
  t.*,
  a.full_name  as assignee_name,
  a.department_id as assignee_department_id,
  c.full_name  as creator_name,
  s.full_name  as suggested_assignee_name,
  p.name       as project_name,
  d.name       as department_name,
  (t.current_deadline is not null
     and t.status not in ('completed', 'cancelled', 'declined')
     and t.current_deadline < public.app_today()) as is_overdue,
  case
    when t.status = 'completed' and t.completed_on_time is true  then 'done_on_time'
    when t.status = 'completed' and t.completed_on_time is false then 'done_late'
    when t.status = 'completed' then 'done'
    when t.status in ('cancelled', 'declined') or t.current_deadline is null then 'none'
    when t.current_deadline < public.app_today() then 'overdue'
    when t.current_deadline - public.app_today() <= public.setting_int('due_soon_days', 2) then 'due_soon'
    else 'on_track'
  end as deadline_state,
  (t.current_deadline is distinct from t.original_deadline) as deadline_extended,
  (select count(*) from public.extension_requests e where e.task_id = t.id)::int as extension_count,
  exists (select 1 from public.extension_requests e where e.task_id = t.id and e.status = 'pending') as has_pending_extension
from public.tasks t
left join public.profiles a    on a.id = t.assignee_id
left join public.profiles c    on c.id = t.created_by
left join public.profiles s    on s.id = t.suggested_assignee_id
left join public.projects p    on p.id = t.project_id
left join public.departments d on d.id = t.department_id;

create view public.extension_overview with (security_invoker = true) as
select
  e.*,
  t.code as task_code, t.title as task_title, t.status as task_status, t.progress as task_progress,
  t.original_deadline as task_original_deadline, t.current_deadline as task_current_deadline,
  t.project_id, t.department_id, t.assignee_id,
  p.name  as project_name,
  d.name  as department_name,
  rq.full_name as requester_name,
  dc.full_name as decider_name,
  (select count(*) from public.extension_requests x where x.task_id = e.task_id and x.created_at < e.created_at)::int as previous_requests
from public.extension_requests e
join public.tasks t on t.id = e.task_id
left join public.projects p    on p.id = t.project_id
left join public.departments d on d.id = t.department_id
left join public.profiles rq   on rq.id = e.requested_by
left join public.profiles dc   on dc.id = e.decided_by;

create view public.activity_overview with (security_invoker = true) as
select l.*, pr.full_name as actor_name, t.code as task_code, t.title as task_title
from public.activity_log l
left join public.profiles pr on pr.id = l.actor_id
left join public.tasks t     on t.id = l.task_id;

create view public.assignment_overview with (security_invoker = true) as
select a.*, f.full_name as from_name, tp.full_name as to_name, b.full_name as by_name
from public.task_assignments a
left join public.profiles f  on f.id = a.from_profile_id
left join public.profiles tp on tp.id = a.to_profile_id
left join public.profiles b  on b.id = a.assigned_by;

-- ---------- Row Level Security ---------------------------------------
alter table public.departments         enable row level security;
alter table public.profiles            enable row level security;
alter table public.permissions         enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.profile_permissions enable row level security;
alter table public.projects            enable row level security;
alter table public.task_batches        enable row level security;
alter table public.tasks               enable row level security;
alter table public.task_assignments    enable row level security;
alter table public.extension_requests  enable row level security;
alter table public.task_comments       enable row level security;
alter table public.attachments         enable row level security;
alter table public.notifications       enable row level security;
alter table public.activity_log        enable row level security;
alter table public.import_runs         enable row level security;
alter table public.app_settings        enable row level security;

-- reference data: readable by any signed-in user
create policy read_signed_in on public.departments      for select to authenticated using (public.current_profile_id() is not null);
create policy read_signed_in on public.profiles         for select to authenticated using (public.current_profile_id() is not null);
create policy read_signed_in on public.permissions      for select to authenticated using (true);
create policy read_signed_in on public.role_permissions for select to authenticated using (true);
create policy read_signed_in on public.projects         for select to authenticated using (public.current_profile_id() is not null);
create policy read_signed_in on public.task_batches     for select to authenticated using (public.current_profile_id() is not null);
create policy read_signed_in on public.app_settings     for select to authenticated using (true);

create policy read_own_or_admin on public.profile_permissions for select to authenticated
  using (profile_id = public.current_profile_id() or public.has_perm('team.manage'));

-- task data: only people who can see the task
create policy read_visible on public.tasks              for select to authenticated using (public.can_view_task(id));
create policy read_visible on public.task_assignments   for select to authenticated using (public.can_view_task(task_id));
create policy read_visible on public.extension_requests for select to authenticated using (public.can_view_task(task_id));
create policy read_visible on public.task_comments      for select to authenticated using (public.can_view_task(task_id));
create policy read_visible on public.attachments        for select to authenticated using (public.can_view_task(task_id));
create policy read_visible on public.activity_log       for select to authenticated
  using ((task_id is not null and public.can_view_task(task_id)) or (task_id is null and public.has_perm('team.manage')));

create policy read_own on public.notifications for select to authenticated using (recipient_id = public.current_profile_id());
create policy read_admin on public.import_runs for select to authenticated using (public.has_perm('import.run'));

-- ---------- Grants: reads through RLS, writes ONLY through functions ---
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;

-- Supabase grants EXECUTE on new functions to anon/authenticated by default; remove it,
-- then whitelist only the public API below. Internal helpers stay private.
revoke execute on all functions in schema public from public, anon, authenticated, service_role;

-- callable API for signed-in users
grant execute on function
  public.current_profile_id(), public.has_perm(text), public.can_view_task(uuid), public.app_today(),
  public.create_tasks(jsonb), public.assign_task(uuid, uuid, text), public.respond_to_assignment(uuid, boolean, text),
  public.transition_task(uuid, text, text), public.update_task(uuid, jsonb), public.update_progress(uuid, int, text),
  public.add_comment(uuid, text), public.register_attachment(uuid, uuid, text, text, text, bigint),
  public.request_extension(uuid, date, text, text), public.decide_extension(uuid, boolean, text),
  public.withdraw_extension(uuid), public.mark_notifications_read(uuid[]), public.run_deadline_checks(),
  public.save_profile(uuid, jsonb), public.set_member_permission(uuid, text, boolean),
  public.set_role_permission(public.app_role, text, boolean), public.save_department(uuid, text, text, uuid),
  public.save_project(uuid, text, text, uuid, text), public.save_setting(text, jsonb),
  public.link_member_login(uuid, uuid, text), public.import_sheet(jsonb)
to authenticated;

-- helpers used inside RLS policies / views must be executable by the caller
grant execute on function
  public.can_view_task_row(public.tasks), public.is_task_manager(uuid, public.tasks),
  public.profile_has_perm(uuid, text), public.setting_int(text, int), public.normalize_name(text)
to authenticated;

grant execute on function public.bootstrap_admin(uuid, text, text) to service_role;

-- log_activity, notify, notify_managers, task_manager_ids,
-- extension_approver_ids, validate_assignee stay internal (no grant).

-- ---------- Seed: permissions & defaults ------------------------------
insert into public.permissions(key, label_ar, label_en) values
  ('tasks.create',       'إنشاء وإسناد وتعديل المهام',   'Create, assign and edit tasks'),
  ('tasks.review',       'مراجعة واعتماد المهام',        'Review and approve tasks'),
  ('tasks.view_all',     'عرض كل مهام الشركة',           'View all company tasks'),
  ('extensions.approve', 'اعتماد طلبات تمديد الموعد',    'Approve deadline extensions'),
  ('team.manage',        'إدارة أعضاء الفريق والأقسام',  'Manage team members and departments'),
  ('projects.manage',    'إدارة المشاريع',               'Manage projects'),
  ('reports.view',       'عرض التقارير',                 'View reports'),
  ('reports.export',     'تصدير التقارير',               'Export reports'),
  ('settings.manage',    'إعدادات النظام',               'System settings'),
  ('import.run',         'استيراد البيانات',             'Import data');

-- admin implicitly has everything; defaults for the other roles:
insert into public.role_permissions(role, permission) values
  ('team_leader', 'tasks.create'),
  ('team_leader', 'tasks.review'),
  ('team_leader', 'reports.view'),
  ('team_leader', 'reports.export');

insert into public.app_settings(key, value) values
  ('due_soon_days',        '2'),
  ('timezone',             '"Africa/Cairo"'),
  ('company_name',         '"فريق العمل"'),
  ('workload_warning_pct', '80');
