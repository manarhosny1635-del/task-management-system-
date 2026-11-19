-- =====================================================================
-- 0002: Business logic. Every write goes through these functions.
-- They validate the caller's role/scope and the workflow transition,
-- then write the change + activity log + notifications in ONE transaction.
-- Error messages are i18n keys (e.g. 'err.not_allowed') translated by the UI.
-- =====================================================================

-- ---------- Generic helpers ------------------------------------------
create or replace function public.app_error(p_key text) returns void
language plpgsql as $$
begin
  raise exception '%', p_key using errcode = 'P0001';
end $$;

-- Arabic-aware name normaliser used for de-duplicating people on import
create or replace function public.normalize_name(p text) returns text
language sql immutable as $$
  select regexp_replace(
           translate(lower(trim(coalesce(p, ''))), 'أإآىةـ', 'ااايه'),
           '\s+', ' ', 'g')
$$;

create or replace function public.setting_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from app_settings where key = p_key), p_default)
$$;

create or replace function public.app_today() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select value #>> '{}' from app_settings where key = 'timezone'), 'Africa/Cairo'))::date
$$;

-- ---------- Current user ---------------------------------------------
create or replace function public.current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where user_id = auth.uid() and is_active
$$;

create or replace function public.require_profile() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare r profiles;
begin
  select * into r from profiles where user_id = auth.uid() and is_active;
  if r.id is null then perform app_error('err.not_authenticated'); end if;
  return r;
end $$;

create or replace function public.profile_has_perm(p_profile uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when not pr.is_active then false
      when pr.role = 'admin' then true
      else coalesce(
        (select pp.granted from profile_permissions pp where pp.profile_id = pr.id and pp.permission = p_perm),
        exists (select 1 from role_permissions rp where rp.role = pr.role and rp.permission = p_perm))
    end
    from profiles pr where pr.id = p_profile), false)
$$;

create or replace function public.has_perm(p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.profile_has_perm(public.current_profile_id(), p_perm)
$$;

-- Is profile p_actor a manager (admin, or leader of the same department) for this task?
create or replace function public.is_task_manager(p_actor uuid, t public.tasks) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when not a.is_active then false
      when a.role = 'admin' then true
      when a.role = 'team_leader' then
           t.created_by = a.id
        or (a.department_id is not null and (
              t.department_id = a.department_id
           or exists (select 1 from profiles x where x.id = t.assignee_id and x.department_id = a.department_id)))
      else false
    end
    from profiles a where a.id = p_actor), false)
$$;

create or replace function public.can_view_task_row(t public.tasks) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.current_profile_id();
begin
  if me is null then return false; end if;
  return t.assignee_id = me
      or t.created_by = me
      or public.has_perm('tasks.view_all')
      or public.is_task_manager(me, t)
      or exists (select 1 from task_assignments a where a.task_id = t.id and a.to_profile_id = me);
end $$;

create or replace function public.can_view_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_view_task_row(t) from tasks t where t.id = p_task), false)
$$;

-- ---------- Logging & notifications ----------------------------------
create or replace function public.log_activity(p_task uuid, p_action text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into activity_log(task_id, actor_id, action, details)
  values (p_task, public.current_profile_id(), p_action, coalesce(p_details, '{}'::jsonb))
$$;

create or replace function public.notify(p_recipient uuid, p_type text, p_task uuid,
                                         p_ext uuid default null, p_data jsonb default '{}'::jsonb,
                                         p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_profile_id();
begin
  if p_recipient is null then return; end if;
  if me is not null and p_recipient = me then return; end if;   -- never notify yourself
  if not exists (select 1 from profiles where id = p_recipient and is_active) then return; end if;
  insert into notifications(recipient_id, type, task_id, extension_request_id, actor_id, data, dedupe_key)
  values (p_recipient, p_type, p_task, p_ext, me, coalesce(p_data, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing;
end $$;

-- People who manage a task: creator, admins, leaders of the task's department
create or replace function public.task_manager_ids(t public.tasks) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct id from (
    select t.created_by as id
    union select p.id from profiles p where p.is_active and p.role = 'admin'
    union select p.id from profiles p where p.is_active and p.role = 'team_leader'
                                       and p.department_id is not null and p.department_id = t.department_id
  ) s where id is not null
$$;

-- People allowed to decide extension requests for a task
create or replace function public.extension_approver_ids(t public.tasks) returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id from profiles p
  where p.is_active
    and public.profile_has_perm(p.id, 'extensions.approve')
    and (p.role = 'admin' or public.is_task_manager(p.id, t))
    and p.id is distinct from t.assignee_id
$$;

create or replace function public.notify_managers(t public.tasks, p_type text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  for r in select * from public.task_manager_ids(t) loop
    perform public.notify(r, p_type, t.id, null, p_data);
  end loop;
end $$;

create or replace function public.task_snapshot(t public.tasks) returns jsonb
language sql stable as $$
  select jsonb_build_object('code', t.code, 'title', t.title)
$$;

-- ---------- Validation helpers ---------------------------------------
create or replace function public.validate_assignee(p_actor public.profiles, p_assignee uuid) returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare a profiles;
begin
  select * into a from profiles where id = p_assignee;
  if a.id is null then perform app_error('err.assignee_not_found'); end if;
  if not a.is_active then perform app_error('err.assignee_inactive'); end if;
  if p_actor.role = 'team_leader'
     and a.id <> p_actor.id
     and (p_actor.department_id is null or a.department_id is distinct from p_actor.department_id) then
    perform app_error('err.assignee_outside_team');
  end if;
  return a;
end $$;

-- =====================================================================
-- TASK CREATION (batch with unlimited rows → independent task records)
-- p_payload = { title?, note?, rows: [ {title, description, assignee_id,
--               priority, start_date, deadline, project_id, department_id,
--               requires_review} ] }
-- =====================================================================
create or replace function public.create_tasks(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me      profiles := public.require_profile();
  v_rows  jsonb := p_payload -> 'rows';
  v_row   jsonb;
  v_batch uuid;
  v_ass   profiles;
  v_task  tasks;
  v_dept  uuid;
  v_dead  date;
  v_start date;
  v_out   jsonb := '[]'::jsonb;
  i       int := 0;
begin
  if not public.has_perm('tasks.create') then perform app_error('err.not_allowed'); end if;
  if v_rows is null or jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows) = 0 then
    perform app_error('err.no_rows');
  end if;
  if jsonb_array_length(v_rows) > 200 then perform app_error('err.too_many_rows'); end if;

  if jsonb_array_length(v_rows) > 1 or coalesce(trim(p_payload ->> 'title'), '') <> '' then
    insert into task_batches(title, note, created_by)
    values (nullif(trim(p_payload ->> 'title'), ''), nullif(trim(p_payload ->> 'note'), ''), me.id)
    returning id into v_batch;
  end if;

  for v_row in select * from jsonb_array_elements(v_rows) loop
    i := i + 1;
    if coalesce(trim(v_row ->> 'title'), '') = '' then
      raise exception 'err.row_title_required|%', i using errcode = 'P0001';
    end if;
    v_dead  := nullif(v_row ->> 'deadline', '')::date;
    v_start := nullif(v_row ->> 'start_date', '')::date;
    if v_dead is null then raise exception 'err.row_deadline_required|%', i using errcode = 'P0001'; end if;
    if v_start is not null and v_start > v_dead then
      raise exception 'err.row_start_after_deadline|%', i using errcode = 'P0001';
    end if;

    v_ass := null;
    if nullif(v_row ->> 'assignee_id', '') is not null then
      v_ass := public.validate_assignee(me, (v_row ->> 'assignee_id')::uuid);
    end if;

    v_dept := coalesce(nullif(v_row ->> 'department_id', '')::uuid,
                       v_ass.department_id,
                       (select department_id from projects where id = nullif(v_row ->> 'project_id', '')::uuid),
                       case when me.role = 'team_leader' then me.department_id end);

    insert into tasks(title, description, project_id, department_id, batch_id, priority, created_by,
                      assignee_id, assigned_at, acceptance, status, requires_review,
                      start_date, original_deadline, current_deadline)
    values (trim(v_row ->> 'title'),
            nullif(trim(v_row ->> 'description'), ''),
            nullif(v_row ->> 'project_id', '')::uuid,
            v_dept,
            v_batch,
            coalesce(nullif(v_row ->> 'priority', '')::task_priority, 'medium'),
            me.id,
            v_ass.id,
            case when v_ass.id is not null then now() end,
            case when v_ass.id is not null then 'pending'::acceptance_status else 'unassigned' end,
            case when v_ass.id is not null then 'pending_acceptance'::task_status else 'new' end,
            coalesce((v_row ->> 'requires_review')::boolean, true),
            v_start, v_dead, v_dead)
    returning * into v_task;

    perform public.log_activity(v_task.id, 'task_created',
      jsonb_build_object('batch_id', v_batch, 'deadline', v_dead, 'priority', v_task.priority));

    if v_ass.id is not null then
      insert into task_assignments(task_id, from_profile_id, to_profile_id, assigned_by, kind)
      values (v_task.id, null, v_ass.id, me.id, 'assign');
      perform public.log_activity(v_task.id, 'task_assigned',
        jsonb_build_object('to', v_ass.id, 'to_name', v_ass.full_name));
      perform public.notify(v_ass.id, 'task_assigned', v_task.id, null, public.task_snapshot(v_task));
    end if;

    v_out := v_out || jsonb_build_object('id', v_task.id, 'code', v_task.code);
  end loop;

  return jsonb_build_object('batch_id', v_batch, 'tasks', v_out);
end $$;

-- =====================================================================
-- ASSIGN / REASSIGN — history is appended, never overwritten
-- =====================================================================
create or replace function public.assign_task(p_task uuid, p_assignee uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me     profiles := public.require_profile();
  t      tasks;
  v_ass  profiles;
  v_prev profiles;
  v_kind text;
  v_ext  record;
begin
  select * into t from tasks where id = p_task for update;
  if t.id is null then perform app_error('err.task_not_found'); end if;
  if not (public.has_perm('tasks.create') and public.is_task_manager(me.id, t)) then
    perform app_error('err.not_allowed');
  end if;
  if t.status in ('completed', 'cancelled') then perform app_error('err.task_locked'); end if;

  v_ass := public.validate_assignee(me, p_assignee);
  if t.assignee_id = v_ass.id then perform app_error('err.already_assigned'); end if;

  select * into v_prev from profiles where id = t.assignee_id;
  v_kind := case when exists (select 1 from task_assignments where task_id = t.id) then 'reassign' else 'assign' end;

  -- close the previous open handover record
  update task_assignments set response = 'superseded', responded_at = now()
   where task_id = t.id and response = 'pending';

  -- a pending extension request by the previous owner is withdrawn
  for v_ext in select id from extension_requests where task_id = t.id and status = 'pending' loop
    update extension_requests set status = 'withdrawn', decided_at = now(),
           decision_reason = 'auto: task reassigned' where id = v_ext.id;
    perform public.log_activity(t.id, 'extension_withdrawn', jsonb_build_object('request_id', v_ext.id, 'auto', true));
  end loop;

  insert into task_assignments(task_id, from_profile_id, to_profile_id, assigned_by, kind, note)
  values (t.id, v_prev.id, v_ass.id, me.id, v_kind, nullif(trim(p_note), ''));

  update tasks set assignee_id = v_ass.id, assigned_at = now(), acceptance = 'pending', accepted_at = null,
                   status = 'pending_acceptance', suggested_assignee_id = null,
                   department_id = coalesce(department_id, v_ass.department_id), updated_at = now()
   where id = t.id;

  perform public.log_activity(t.id, case when v_kind = 'assign' then 'task_assigned' else 'task_reassigned' end,
    jsonb_build_object('from', v_prev.id, 'from_name', v_prev.full_name,
                       'to', v_ass.id, 'to_name', v_ass.full_name,
                       'previous_status', t.status, 'note', nullif(trim(p_note), '')));

  perform public.notify(v_ass.id, case when v_kind = 'assign' then 'task_assigned' else 'task_reassigned_to_you' end,
                        t.id, null, public.task_snapshot(t));
  if v_prev.id is not null then
    perform public.notify(v_prev.id, 'task_reassigned_away', t.id, null,
                          public.task_snapshot(t) || jsonb_build_object('to_name', v_ass.full_name));
  end if;
end $$;

-- =====================================================================
-- ACCEPT / REJECT an assignment (assignee only)
-- =====================================================================
create or replace function public.respond_to_assignment(p_task uuid, p_accept boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me profiles := public.require_profile();
  t  tasks;
begin
  select * into t from tasks where id = p_task for update;
  if t.id is null then perform app_error('err.task_not_found'); end if;
  if t.assignee_id is distinct from me.id then perform app_error('err.not_assignee'); end if;
  if t.status <> 'pending_acceptance' then perform app_error('err.invalid_transition'); end if;

  if p_accept then
    update tasks set acceptance = 'accepted', accepted_at = now(), status = 'accepted', updated_at = now()
     where id = t.id;
    update task_assignments set response = 'accepted', responded_at = now()
     where task_id = t.id and to_profile_id = me.id and response = 'pending';
    perform public.log_activity(t.id, 'assignment_accepted', '{}'::jsonb);
    perform public.notify_managers(t, 'task_accepted', public.task_snapshot(t) || jsonb_build_object('by_name', me.full_name));
  else
    if length(trim(coalesce(p_reason, ''))) < 3 then perform app_error('err.reason_required'); end if;
    update tasks set acceptance = 'rejected', status = 'declined', assignee_id = null,
                     suggested_assignee_id = null, updated_at = now()
     where id = t.id;
    update task_assignments set response = 'rejected', response_reason = trim(p_reason), responded_at = now()
     where task_id = t.id and to_profile_id = me.id and response = 'pending';
    perform public.log_activity(t.id, 'assignment_rejected', jsonb_build_object('reason', trim(p_reason)));
    perform public.notify_managers(t, 'task_rejected',
      public.task_snapshot(t) || jsonb_build_object('by_name', me.full_name, 'reason', trim(p_reason)));
  end if;
end $$;

-- =====================================================================
-- STATUS TRANSITIONS
-- actions: start | hold | resume | submit | approve | request_changes | cancel
-- =====================================================================
create or replace function public.transition_task(p_task uuid, p_action text, p_note text default null)
returns public.task_status language plpgsql security definer set search_path = public as $$
declare
  me        profiles := public.require_profile();
  t         tasks;
  v_to      task_status;
  v_note    text := nullif(trim(p_note), '');
  is_owner  boolean;
  is_mgr    boolean;
  v_on_time boolean;
begin
  select * into t from tasks where id = p_task for update;
  if t.id is null then perform app_error('err.task_not_found'); end if;
  is_owner := t.assignee_id = me.id;
  is_mgr   := public.is_task_manager(me.id, t);

  case p_action
    when 'start' then
      if not is_owner then perform app_error('err.not_assignee'); end if;
      if t.status not in ('accepted', 'changes_requested') then perform app_error('err.invalid_transition'); end if;
      v_to := 'in_progress';

    when 'hold' then
      if not (is_owner or is_mgr) then perform app_error('err.not_allowed'); end if;
      if t.status not in ('accepted', 'in_progress', 'changes_requested') then perform app_error('err.invalid_transition'); end if;
      if v_note is null then perform app_error('err.reason_required'); end if;
      v_to := 'on_hold';

    when 'resume' then
      if not (is_owner or is_mgr) then perform app_error('err.not_allowed'); end if;
      if t.status <> 'on_hold' then perform app_error('err.invalid_transition'); end if;
      v_to := 'in_progress';

    when 'submit' then
      if not is_owner then perform app_error('err.not_assignee'); end if;
      if t.status not in ('in_progress', 'changes_requested') then perform app_error('err.invalid_transition'); end if;
      v_to := case when t.requires_review then 'submitted' else 'completed' end;

    when 'approve' then
      if t.status <> 'submitted' then perform app_error('err.invalid_transition'); end if;
      if is_owner then perform app_error('err.cannot_review_own'); end if;
      if not (is_mgr and public.has_perm('tasks.review')) then perform app_error('err.not_allowed'); end if;
      v_to := 'completed';

    when 'request_changes' then
      if t.status <> 'submitted' then perform app_error('err.invalid_transition'); end if;
      if is_owner then perform app_error('err.cannot_review_own'); end if;
      if not (is_mgr and public.has_perm('tasks.review')) then perform app_error('err.not_allowed'); end if;
      if v_note is null then perform app_error('err.reason_required'); end if;
      v_to := 'changes_requested';

    when 'cancel' then
      if not (is_mgr and public.has_perm('tasks.create')) then perform app_error('err.not_allowed'); end if;
      if t.status in ('completed', 'cancelled') then perform app_error('err.invalid_transition'); end if;
      if v_note is null then perform app_error('err.reason_required'); end if;
      v_to := 'cancelled';

    else
      perform app_error('err.invalid_action');
  end case;

  if v_to = 'completed' then
    v_on_time := t.current_deadline is null or public.app_today() <= t.current_deadline;
  end if;

  update tasks set
    status            = v_to,
    progress          = case when v_to = 'completed' then 100 else progress end,
    submitted_at      = case when v_to = 'submitted' or (p_action = 'submit' and v_to = 'completed') then now() else submitted_at end,
    completed_at      = case when v_to = 'completed' then now() else completed_at end,
    completed_on_time = case when v_to = 'completed' then v_on_time else completed_on_time end,
    reviewed_by       = case when p_action in ('approve', 'request_changes') then me.id else reviewed_by end,
    updated_at        = now()
  where id = t.id;

  -- cancelling closes any pending extension request
  if v_to = 'cancelled' then
    update extension_requests set status = 'withdrawn', decided_at = now(), decision_reason = 'auto: task cancelled'
     where task_id = t.id and status = 'pending';
  end if;

  perform public.log_activity(t.id, 'status_changed',
    jsonb_build_object('from', t.status, 'to', v_to, 'action', p_action, 'note', v_note));

  if p_action = 'submit' and v_to = 'submitted' then
    perform public.notify_managers(t, 'task_submitted', public.task_snapshot(t) || jsonb_build_object('by_name', me.full_name));
  elsif p_action = 'submit' and v_to = 'completed' then
    perform public.notify_managers(t, 'task_completed', public.task_snapshot(t) || jsonb_build_object('by_name', me.full_name));
  elsif p_action = 'approve' then
    perform public.notify(t.assignee_id, 'task_approved', t.id, null, public.task_snapshot(t));
  elsif p_action = 'request_changes' then
    perform public.notify(t.assignee_id, 'task_changes_requested', t.id, null, public.task_snapshot(t) || jsonb_build_object('note', v_note));
  elsif p_action = 'cancel' then
    perform public.notify(t.assignee_id, 'task_cancelled', t.id, null, public.task_snapshot(t) || jsonb_build_object('note', v_note));
  elsif p_action in ('hold', 'resume') and not is_owner then
    perform public.notify(t.assignee_id, 'task_' || p_action, t.id, null, public.task_snapshot(t) || jsonb_build_object('note', v_note));
  elsif p_action in ('hold', 'resume') and is_owner then
    perform public.notify_managers(t, 'task_' || p_action, public.task_snapshot(t) || jsonb_build_object('by_name', me.full_name, 'note', v_note));
  end if;

  return v_to;
end $$;

-- =====================================================================
-- EDIT TASK (managers). Completed/cancelled tasks are locked.
-- Direct deadline changes only for users holding 'extensions.approve';
-- original_deadline is never overwritten once set.
-- =====================================================================
create or replace function public.update_task(p_task uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  me      profiles := public.require_profile();
  t       tasks;
  v_new   date;
  changes jsonb := '{}'::jsonb;
  k       text;
begin
  select * into t from tasks where id = p_task for update;
  if t.id is null then perform app_error('err.task_not_found'); end if;
  if not (public.has_perm('tasks.create') and public.is_task_manager(me.id, t)) then perform app_error('err.not_allowed'); end if;
  if t.status in ('completed', 'cancelled') then perform app_error('err.task_locked'); end if;

  foreach k in array array['title', 'description', 'priority', 'project_id', 'department_id', 'start_date', 'requires_review'] loop
    if p_patch ? k and (p_patch ->> k) is distinct from (to_jsonb(t) ->> k) then
      changes := changes || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(t) -> k, 'to', p_patch -> k));
    end if;
  end loop;

  if p_patch ? 'title' and coalesce(trim(p_patch ->> 'title'), '') = '' then perform app_error('err.title_required'); end if;

  update tasks set
    title           = case when p_patch ? 'title' then trim(p_patch ->> 'title') else title end,
    description     = case when p_patch ? 'description' then nullif(trim(p_patch ->> 'description'), '') else description end,
    priority        = case when p_patch ? 'priority' then (p_patch ->> 'priority')::task_priority else priority end,
    project_id      = case when p_patch ? 'project_id' then nullif(p_patch ->> 'project_id', '')::uuid else project_id end,
    department_id   = case when p_patch ? 'department_id' then nullif(p_patch ->> 'department_id', '')::uuid else department_id end,
    start_date      = case when p_patch ? 'start_date' then nullif(p_patch ->> 'start_date', '')::date else start_date end,
    requires_review = case when p_patch ? 'requires_review' then (p_patch ->> 'requires_review')::boolean else requires_review end,
    updated_at      = now()
  where id = t.id;

  if p_patch ? 'deadline' then
    v_new := nullif(p_patch ->> 'deadline', '')::date;
    if v_new is null then perform app_error('err.deadline_required'); end if;
    if v_new is distinct from t.current_deadline then
      if not public.has_perm('extensions.approve') then perform app_error('err.deadline_change_not_allowed'); end if;
      if exists (select 1 from extension_requests where task_id = t.id and status = 'pending') then
        perform app_error('err.pending_extension_exists');
      end if;
      update tasks set current_deadline = v_new,
                       original_deadline = coalesce(original_deadline, v_new)
       where id = t.id;
      perform public.log_activity(t.id, 'deadline_changed',
        jsonb_build_object('from', t.current_deadline, 'to', v_new, 'original', coalesce(t.original_deadline, v_new)));
      perform public.notify(t.assignee_id, 'deadline_changed', t.id, null,
        public.task_snapshot(t) || jsonb_build_object('to', v_new));
    end if;
  end if;

  if changes <> '{}'::jsonb then
    perform public.log_activity(t.id, 'task_updated', changes);
  end if;
end $$;

-- =====================================================================
-- PROGRESS, COMMENTS, ATTACHMENTS
-- =====================================================================
create or replace function public.update_progress(p_task uuid, p_progress int, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile(); t tasks;
begin
  select * into t from tasks where id = p_task for update;
  if t.id is null then perform app_error('err.task_not_found'); end if;
  if t.assignee_id is distinct from me.id then perform app_error('err.not_assignee'); end if;
  if t.status not in ('in_progress', 'changes_requested', 'on_hold') then perform app_error('err.invalid_transition'); end if;
  if p_progress < 0 or p_progress > 100 then perform app_error('err.invalid_progress'); end if;
  update tasks set progress = p_progress, updated_at = now() where id = t.id;
  if nullif(trim(p_note), '') is not null then
    insert into task_comments(task_id, author_id, kind, body) values (t.id, me.id, 'progress', trim(p_note));
  end if;
  perform public.log_activity(t.id, 'progress_updated',
    jsonb_build_object('from', t.progress, 'to', p_progress, 'note', nullif(trim(p_note), '')));
end $$;

create or replace function public.add_comment(p_task uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile(); t tasks; v_id uuid; r uuid;
begin
  select * into t from tasks where id = p_task;
  if t.id is null then perform app_error('err.task_not_found'); end if;
  if not public.can_view_task_row(t) then perform app_error('err.not_allowed'); end if;
  if coalesce(trim(p_body), '') = '' then perform app_error('err.comment_empty'); end if;
  insert into task_comments(task_id, author_id, body) values (t.id, me.id, trim(p_body)) returning id into v_id;
  perform public.log_activity(t.id, 'comment_added', jsonb_build_object('comment_id', v_id, 'excerpt', left(trim(p_body), 140)));
  if me.id = t.assignee_id then
    for r in select * from public.task_manager_ids(t) loop
      perform public.notify(r, 'comment_added', t.id, null, public.task_snapshot(t) || jsonb_build_object('by_name', me.full_name));
    end loop;
  else
    perform public.notify(t.assignee_id, 'comment_added', t.id, null, public.task_snapshot(t) || jsonb_build_object('by_name', me.full_name));
  end if;
  return v_id;
end $$;

create or replace function public.register_attachment(p_task uuid, p_ext uuid, p_file_name text, p_path text,
                                                      p_mime text, p_size bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile(); t tasks; v_id uuid;
begin
  select * into t from tasks where id = p_task;
  if t.id is null then perform app_error('err.task_not_found'); end if;
  if not public.can_view_task_row(t) then perform app_error('err.not_allowed'); end if;
  if p_path not like 'tasks/' || t.id::text || '/%' then perform app_error('err.invalid_path'); end if;
  if p_ext is not null and not exists (select 1 from extension_requests where id = p_ext and task_id = t.id and requested_by = me.id) then
    perform app_error('err.not_allowed');
  end if;
  insert into attachments(task_id, extension_request_id, uploaded_by, file_name, storage_path, mime_type, size_bytes)
  values (t.id, p_ext, me.id, p_file_name, p_path, p_mime, p_size) returning id into v_id;
  perform public.log_activity(t.id, 'attachment_added', jsonb_build_object('file_name', p_file_name, 'extension_request_id', p_ext));
  return v_id;
end $$;

-- =====================================================================
-- DEADLINE EXTENSION REQUESTS
-- =====================================================================
create or replace function public.request_extension(p_task uuid, p_new_deadline date, p_reason text, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile(); t tasks; v_id uuid; r uuid;
begin
  select * into t from tasks where id = p_task for update;
  if t.id is null then perform app_error('err.task_not_found'); end if;
  if t.assignee_id is distinct from me.id then perform app_error('err.not_assignee'); end if;
  if t.status not in ('accepted', 'in_progress', 'on_hold', 'changes_requested', 'submitted') then
    perform app_error('err.extension_not_allowed_in_status');
  end if;
  if t.current_deadline is null then perform app_error('err.task_has_no_deadline'); end if;
  if p_new_deadline is null or p_new_deadline <= t.current_deadline then perform app_error('err.new_deadline_must_be_later'); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then perform app_error('err.reason_required'); end if;
  if exists (select 1 from extension_requests where task_id = t.id and status = 'pending') then
    perform app_error('err.pending_extension_exists');
  end if;

  insert into extension_requests(task_id, requested_by, original_deadline, previous_deadline, requested_deadline,
                                 reason, notes, progress_at_request)
  values (t.id, me.id, t.original_deadline, t.current_deadline, p_new_deadline,
          trim(p_reason), nullif(trim(p_notes), ''), t.progress)
  returning id into v_id;

  perform public.log_activity(t.id, 'extension_requested',
    jsonb_build_object('request_id', v_id, 'from', t.current_deadline, 'to', p_new_deadline, 'reason', trim(p_reason)));

  for r in select * from public.extension_approver_ids(t) loop
    perform public.notify(r, 'extension_requested', t.id, v_id,
      public.task_snapshot(t) || jsonb_build_object('by_name', me.full_name, 'to', p_new_deadline));
  end loop;
  return v_id;
end $$;

create or replace function public.decide_extension(p_request uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile(); e extension_requests; t tasks;
begin
  select * into e from extension_requests where id = p_request for update;
  if e.id is null then perform app_error('err.request_not_found'); end if;
  select * into t from tasks where id = e.task_id for update;

  -- nobody approves their own request, nor a request on a task they own
  if e.requested_by = me.id or t.assignee_id = me.id then perform app_error('err.cannot_approve_own'); end if;
  if not public.has_perm('extensions.approve') then perform app_error('err.not_allowed'); end if;
  if me.role <> 'admin' and not public.is_task_manager(me.id, t) then perform app_error('err.not_allowed'); end if;
  if e.status <> 'pending' then perform app_error('err.request_already_decided'); end if;
  if t.status in ('completed', 'cancelled', 'declined') then perform app_error('err.task_locked'); end if;

  if p_approve then
    update extension_requests set status = 'approved', decided_by = me.id, decided_at = now(),
           decision_reason = nullif(trim(p_reason), '') where id = e.id;
    -- only current_deadline moves; original_deadline is permanent
    update tasks set current_deadline = e.requested_deadline, updated_at = now() where id = t.id;
    perform public.log_activity(t.id, 'extension_approved',
      jsonb_build_object('request_id', e.id, 'from', t.current_deadline, 'to', e.requested_deadline,
                         'original', t.original_deadline, 'by_name', me.full_name, 'note', nullif(trim(p_reason), '')));
    perform public.notify(e.requested_by, 'extension_approved', t.id, e.id,
      public.task_snapshot(t) || jsonb_build_object('to', e.requested_deadline));
  else
    if length(trim(coalesce(p_reason, ''))) < 3 then perform app_error('err.reason_required'); end if;
    update extension_requests set status = 'rejected', decided_by = me.id, decided_at = now(),
           decision_reason = trim(p_reason) where id = e.id;
    perform public.log_activity(t.id, 'extension_rejected',
      jsonb_build_object('request_id', e.id, 'requested', e.requested_deadline, 'reason', trim(p_reason), 'by_name', me.full_name));
    perform public.notify(e.requested_by, 'extension_rejected', t.id, e.id,
      public.task_snapshot(t) || jsonb_build_object('reason', trim(p_reason)));
  end if;
end $$;

create or replace function public.withdraw_extension(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile(); e extension_requests;
begin
  select * into e from extension_requests where id = p_request for update;
  if e.id is null then perform app_error('err.request_not_found'); end if;
  if e.requested_by <> me.id then perform app_error('err.not_allowed'); end if;
  if e.status <> 'pending' then perform app_error('err.request_already_decided'); end if;
  update extension_requests set status = 'withdrawn', decided_at = now() where id = e.id;
  perform public.log_activity(e.task_id, 'extension_withdrawn', jsonb_build_object('request_id', e.id));
end $$;

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================
create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns void
language sql security definer set search_path = public as $$
  update notifications set is_read = true
   where recipient_id = public.current_profile_id() and not is_read
     and (p_ids is null or id = any(p_ids))
$$;

-- Deadline approaching / overdue — idempotent (dedupe keys); run by pg_cron and on dashboard load
create or replace function public.run_deadline_checks() returns int
language plpgsql security definer set search_path = public as $$
declare
  t tasks; r uuid; n int := 0;
  v_today date := public.app_today();
  v_soon  int  := public.setting_int('due_soon_days', 2);
begin
  for t in select * from tasks
           where current_deadline is not null and assignee_id is not null
             and status in ('accepted', 'in_progress', 'on_hold', 'changes_requested', 'pending_acceptance')
  loop
    if t.current_deadline < v_today then
      insert into notifications(recipient_id, type, task_id, data, dedupe_key)
      values (t.assignee_id, 'task_overdue', t.id, public.task_snapshot(t) || jsonb_build_object('deadline', t.current_deadline),
              'overdue:' || t.id || ':' || t.current_deadline || ':' || t.assignee_id)
      on conflict (dedupe_key) do nothing;
      for r in select * from public.task_manager_ids(t) loop
        insert into notifications(recipient_id, type, task_id, data, dedupe_key)
        values (r, 'task_overdue', t.id, public.task_snapshot(t) || jsonb_build_object('deadline', t.current_deadline),
                'overdue:' || t.id || ':' || t.current_deadline || ':' || r)
        on conflict (dedupe_key) do nothing;
      end loop;
      n := n + 1;
    elsif t.current_deadline - v_today <= v_soon then
      insert into notifications(recipient_id, type, task_id, data, dedupe_key)
      values (t.assignee_id, 'deadline_approaching', t.id, public.task_snapshot(t) || jsonb_build_object('deadline', t.current_deadline),
              'soon:' || t.id || ':' || t.current_deadline || ':' || t.assignee_id)
      on conflict (dedupe_key) do nothing;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- =====================================================================
-- ADMINISTRATION: team, departments, projects, permissions, settings
-- =====================================================================
create or replace function public.save_profile(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile(); v_id uuid; old profiles;
begin
  if not public.has_perm('team.manage') then perform app_error('err.not_allowed'); end if;
  if coalesce(trim(p_data ->> 'full_name'), '') = '' then perform app_error('err.name_required'); end if;

  if p_id is null then
    insert into profiles(full_name, email, phone, job_title, role, department_id, max_active_tasks, name_key)
    values (trim(p_data ->> 'full_name'), nullif(lower(trim(p_data ->> 'email')), ''), nullif(trim(p_data ->> 'phone'), ''),
            nullif(trim(p_data ->> 'job_title'), ''), coalesce(nullif(p_data ->> 'role', '')::app_role, 'employee'),
            nullif(p_data ->> 'department_id', '')::uuid, coalesce((p_data ->> 'max_active_tasks')::int, 5),
            public.normalize_name(p_data ->> 'full_name'))
    returning id into v_id;
    perform public.log_activity(null, 'member_created', jsonb_build_object('profile_id', v_id, 'name', p_data ->> 'full_name'));
  else
    select * into old from profiles where id = p_id;
    if old.id is null then perform app_error('err.member_not_found'); end if;
    -- an admin cannot demote or deactivate themselves (prevents lock-out)
    if old.id = me.id and (coalesce(nullif(p_data ->> 'role', '')::app_role, old.role) <> 'admin'
                           or coalesce((p_data ->> 'is_active')::boolean, true) = false) then
      perform app_error('err.cannot_demote_self');
    end if;
    update profiles set
      full_name        = trim(p_data ->> 'full_name'),
      email            = case when p_data ? 'email' then nullif(lower(trim(p_data ->> 'email')), '') else email end,
      phone            = case when p_data ? 'phone' then nullif(trim(p_data ->> 'phone'), '') else phone end,
      job_title        = case when p_data ? 'job_title' then nullif(trim(p_data ->> 'job_title'), '') else job_title end,
      role             = coalesce(nullif(p_data ->> 'role', '')::app_role, role),
      department_id    = case when p_data ? 'department_id' then nullif(p_data ->> 'department_id', '')::uuid else department_id end,
      is_active        = coalesce((p_data ->> 'is_active')::boolean, is_active),
      max_active_tasks = coalesce((p_data ->> 'max_active_tasks')::int, max_active_tasks),
      name_key         = public.normalize_name(p_data ->> 'full_name'),
      updated_at       = now()
    where id = p_id;
    v_id := p_id;
    perform public.log_activity(null, 'member_updated', jsonb_build_object(
      'profile_id', v_id, 'name', p_data ->> 'full_name',
      'role', jsonb_build_object('from', old.role, 'to', coalesce(nullif(p_data ->> 'role', ''), old.role::text)),
      'is_active', jsonb_build_object('from', old.is_active, 'to', coalesce((p_data ->> 'is_active')::boolean, old.is_active))));
  end if;
  return v_id;
end $$;

create or replace function public.set_member_permission(p_profile uuid, p_perm text, p_granted boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile();
begin
  if not public.has_perm('team.manage') then perform app_error('err.not_allowed'); end if;
  if p_granted is null then
    delete from profile_permissions where profile_id = p_profile and permission = p_perm;
  else
    insert into profile_permissions(profile_id, permission, granted) values (p_profile, p_perm, p_granted)
    on conflict (profile_id, permission) do update set granted = excluded.granted;
  end if;
  perform public.log_activity(null, 'permission_changed', jsonb_build_object('profile_id', p_profile, 'permission', p_perm, 'granted', p_granted));
end $$;

create or replace function public.set_role_permission(p_role public.app_role, p_perm text, p_granted boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile();
begin
  if not public.has_perm('settings.manage') then perform app_error('err.not_allowed'); end if;
  if p_role = 'admin' then perform app_error('err.admin_has_all'); end if;
  if p_granted then
    insert into role_permissions(role, permission) values (p_role, p_perm) on conflict do nothing;
  else
    delete from role_permissions where role = p_role and permission = p_perm;
  end if;
  perform public.log_activity(null, 'role_permission_changed', jsonb_build_object('role', p_role, 'permission', p_perm, 'granted', p_granted));
end $$;

create or replace function public.save_department(p_id uuid, p_name text, p_description text, p_leader uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile(); v_id uuid;
begin
  if not public.has_perm('team.manage') then perform app_error('err.not_allowed'); end if;
  if coalesce(trim(p_name), '') = '' then perform app_error('err.name_required'); end if;
  if p_id is null then
    insert into departments(name, description, leader_id) values (trim(p_name), nullif(trim(p_description), ''), p_leader)
    returning id into v_id;
  else
    update departments set name = trim(p_name), description = nullif(trim(p_description), ''), leader_id = p_leader
     where id = p_id;
    v_id := p_id;
  end if;
  if p_leader is not null then
    update profiles set department_id = v_id,
                        role = case when role = 'employee' then 'team_leader'::app_role else role end
     where id = p_leader;
  end if;
  perform public.log_activity(null, 'department_saved', jsonb_build_object('department_id', v_id, 'name', trim(p_name)));
  return v_id;
end $$;

create or replace function public.save_project(p_id uuid, p_name text, p_description text, p_department uuid, p_status text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile(); v_id uuid;
begin
  if not public.has_perm('projects.manage') then perform app_error('err.not_allowed'); end if;
  if coalesce(trim(p_name), '') = '' then perform app_error('err.name_required'); end if;
  if p_id is null then
    insert into projects(name, description, department_id, status, created_by)
    values (trim(p_name), nullif(trim(p_description), ''), p_department, coalesce(p_status, 'active'), me.id)
    returning id into v_id;
  else
    update projects set name = trim(p_name), description = nullif(trim(p_description), ''),
                        department_id = p_department, status = coalesce(p_status, status)
     where id = p_id;
    v_id := p_id;
  end if;
  perform public.log_activity(null, 'project_saved', jsonb_build_object('project_id', v_id, 'name', trim(p_name)));
  return v_id;
end $$;

create or replace function public.save_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile();
begin
  if not public.has_perm('settings.manage') then perform app_error('err.not_allowed'); end if;
  insert into app_settings(key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
  perform public.log_activity(null, 'setting_changed', jsonb_build_object('key', p_key, 'value', p_value));
end $$;

-- Link a login (auth user) to a team member — called by the server with the
-- caller's session after it created the auth user using the service key.
create or replace function public.link_member_login(p_profile uuid, p_user uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := public.require_profile();
begin
  if not public.has_perm('team.manage') then perform app_error('err.not_allowed'); end if;
  update profiles set user_id = p_user, email = lower(trim(p_email)), updated_at = now() where id = p_profile;
  perform public.log_activity(null, 'login_created', jsonb_build_object('profile_id', p_profile, 'email', lower(trim(p_email))));
end $$;

-- =====================================================================
-- SPREADSHEET IMPORT
-- p_payload = { source_name,
--   employees: [ {name, row} ],
--   tasks: [ {import_key, title, assignee_name, suggested_name, status
--             ('in_progress'|'completed'|'new'), assignment_date, deadline,
--             notes, row} ] }
-- Duplicate people (normalised name) and duplicate tasks (import_key) are skipped.
-- =====================================================================
create or replace function public.import_sheet(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles := public.require_profile();
  e jsonb; tk jsonb;
  v_pid uuid; v_tid uuid; v_ass uuid; v_sug uuid;
  v_status task_status; v_dead date; v_assigned date;
  emp_new int := 0; emp_existing int := 0; t_new int := 0; t_dup int := 0;
  errs jsonb := '[]'::jsonb;
  v_run uuid;
begin
  if not public.has_perm('import.run') then perform app_error('err.not_allowed'); end if;

  for e in select * from jsonb_array_elements(coalesce(p_payload -> 'employees', '[]'::jsonb)) loop
    if coalesce(trim(e ->> 'name'), '') = '' then continue; end if;
    select id into v_pid from profiles where name_key = public.normalize_name(e ->> 'name') limit 1;
    if v_pid is null then
      insert into profiles(full_name, name_key) values (trim(e ->> 'name'), public.normalize_name(e ->> 'name'));
      emp_new := emp_new + 1;
    else
      emp_existing := emp_existing + 1;
    end if;
  end loop;

  for tk in select * from jsonb_array_elements(coalesce(p_payload -> 'tasks', '[]'::jsonb)) loop
    begin
      if coalesce(trim(tk ->> 'title'), '') = '' then
        errs := errs || jsonb_build_object('row', tk -> 'row', 'error', 'empty_title'); continue;
      end if;
      if exists (select 1 from tasks where import_key = tk ->> 'import_key') then
        t_dup := t_dup + 1; continue;
      end if;
      v_ass := (select id from profiles where name_key = public.normalize_name(tk ->> 'assignee_name') limit 1);
      v_sug := (select id from profiles where name_key = public.normalize_name(tk ->> 'suggested_name') limit 1);
      v_status := coalesce(nullif(tk ->> 'status', ''), 'in_progress')::task_status;
      v_dead := nullif(tk ->> 'deadline', '')::date;
      v_assigned := nullif(tk ->> 'assignment_date', '')::date;
      if v_status <> 'new' and v_ass is null then
        errs := errs || jsonb_build_object('row', tk -> 'row', 'error', 'assignee_not_found', 'name', tk ->> 'assignee_name');
        continue;
      end if;
      if v_status = 'new' then v_ass := null; end if;

      insert into tasks(title, created_by, assignee_id, suggested_assignee_id, assigned_at, acceptance, accepted_at,
                        status, progress, original_deadline, current_deadline, completed_at, completed_on_time,
                        department_id, source, import_key, requires_review)
      values (trim(tk ->> 'title'), me.id, v_ass, v_sug,
              case when v_ass is not null then coalesce(v_assigned::timestamptz, now()) end,
              case when v_ass is not null then 'accepted'::acceptance_status else 'unassigned' end,
              case when v_ass is not null then coalesce(v_assigned::timestamptz, now()) end,
              v_status, case when v_status = 'completed' then 100 else 0 end,
              v_dead, v_dead,
              case when v_status = 'completed' then now() end,
              null,
              (select department_id from profiles where id = coalesce(v_ass, v_sug)),
              'import', tk ->> 'import_key', true)
      returning id into v_tid;

      if v_ass is not null then
        insert into task_assignments(task_id, to_profile_id, assigned_by, kind, response, responded_at, note)
        values (v_tid, v_ass, me.id, 'assign', 'accepted', now(), 'imported from spreadsheet');
      end if;
      if nullif(trim(tk ->> 'notes'), '') is not null then
        insert into task_comments(task_id, author_id, kind, body) values (v_tid, me.id, 'note', trim(tk ->> 'notes'));
      end if;
      perform public.log_activity(v_tid, 'task_imported',
        jsonb_build_object('row', tk -> 'row', 'source', p_payload ->> 'source_name', 'status', v_status,
                           'assignee_name', tk ->> 'assignee_name'));
      t_new := t_new + 1;
    exception when others then
      errs := errs || jsonb_build_object('row', tk -> 'row', 'error', sqlerrm, 'title', tk ->> 'title');
    end;
  end loop;

  insert into import_runs(created_by, source_name, summary, errors)
  values (me.id, p_payload ->> 'source_name',
          jsonb_build_object('employees_created', emp_new, 'employees_existing', emp_existing,
                             'tasks_created', t_new, 'tasks_duplicate', t_dup, 'errors', jsonb_array_length(errs)),
          errs)
  returning id into v_run;

  return jsonb_build_object('run_id', v_run, 'employees_created', emp_new, 'employees_existing', emp_existing,
                            'tasks_created', t_new, 'tasks_duplicate', t_dup, 'errors', errs);
end $$;

-- =====================================================================
-- Bootstrap: make the very first linked user an admin (only works while
-- no admin exists). Used by scripts/create-admin.mjs.
-- =====================================================================
create or replace function public.bootstrap_admin(p_user uuid, p_name text, p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if exists (select 1 from profiles where role = 'admin' and user_id is not null) then
    perform app_error('err.admin_exists');
  end if;
  select id into v_id from profiles where name_key = public.normalize_name(p_name) limit 1;
  if v_id is null then
    insert into profiles(full_name, email, role, user_id, name_key)
    values (trim(p_name), lower(trim(p_email)), 'admin', p_user, public.normalize_name(p_name)) returning id into v_id;
  else
    update profiles set role = 'admin', user_id = p_user, email = lower(trim(p_email)) where id = v_id;
  end if;
  return v_id;
end $$;
