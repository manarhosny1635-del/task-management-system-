-- =====================================================================
-- TaskFlow — نظام إدارة مهام الفريق
-- 0001: Core schema (tables, enums, indexes)
-- =====================================================================

-- gen_random_uuid() is built into Postgres 13+

-- ---------- Enums ----------------------------------------------------
create type public.app_role as enum ('admin', 'team_leader', 'employee');

create type public.task_status as enum (
  'new',                 -- جديد / غير مُسند
  'pending_acceptance',  -- بانتظار القبول
  'accepted',            -- مقبول
  'in_progress',         -- قيد التنفيذ
  'on_hold',             -- معلّق / متوقف
  'submitted',           -- مُسلّم للمراجعة
  'changes_requested',   -- مطلوب تعديلات
  'completed',           -- مكتمل
  'declined',            -- رفضه الموظف — عاد للإدارة لإعادة الإسناد
  'cancelled'            -- ملغي
);

create type public.acceptance_status as enum ('unassigned', 'pending', 'accepted', 'rejected');
create type public.task_priority     as enum ('low', 'medium', 'high', 'urgent');
create type public.extension_status  as enum ('pending', 'approved', 'rejected', 'withdrawn');

-- ---------- Organisation ---------------------------------------------
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  description text,
  leader_id   uuid,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users(id) on delete set null,
  full_name        text not null check (length(trim(full_name)) > 0),
  email            text unique,
  phone            text,
  job_title        text,
  role             public.app_role not null default 'employee',
  department_id    uuid references public.departments(id) on delete set null,
  is_active        boolean not null default true,
  max_active_tasks integer not null default 5 check (max_active_tasks between 1 and 100),
  name_key         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.departments
  add constraint departments_leader_fk foreign key (leader_id) references public.profiles(id) on delete set null;

create index profiles_department_idx on public.profiles(department_id);
create index profiles_name_key_idx  on public.profiles(name_key);

-- ---------- Permissions ----------------------------------------------
create table public.permissions (
  key      text primary key,
  label_ar text not null,
  label_en text not null
);

create table public.role_permissions (
  role       public.app_role not null,
  permission text not null references public.permissions(key) on delete cascade,
  primary key (role, permission)
);

-- Per-user override: granted=true adds, granted=false removes a role permission
create table public.profile_permissions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null references public.permissions(key) on delete cascade,
  granted    boolean not null,
  primary key (profile_id, permission)
);

-- ---------- Projects & batches ----------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique check (length(trim(name)) > 0),
  description   text,
  department_id uuid references public.departments(id) on delete set null,
  status        text not null default 'active' check (status in ('active', 'on_hold', 'completed', 'archived')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create table public.task_batches (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  note       text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Tasks -----------------------------------------------------
create sequence public.task_number_seq start 1001;

create table public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique default ('T-' || nextval('public.task_number_seq')),
  title                 text not null check (length(trim(title)) > 0),
  description           text,
  project_id            uuid references public.projects(id) on delete set null,
  department_id         uuid references public.departments(id) on delete set null,
  batch_id              uuid references public.task_batches(id) on delete set null,
  priority              public.task_priority not null default 'medium',
  created_by            uuid not null references public.profiles(id),
  assignee_id           uuid references public.profiles(id),
  suggested_assignee_id uuid references public.profiles(id),
  assigned_at           timestamptz,
  acceptance            public.acceptance_status not null default 'unassigned',
  accepted_at           timestamptz,
  status                public.task_status not null default 'new',
  requires_review       boolean not null default true,
  progress              integer not null default 0 check (progress between 0 and 100),
  start_date            date,
  original_deadline     date,      -- never changes after first set
  current_deadline      date,      -- latest APPROVED deadline
  submitted_at          timestamptz,
  completed_at          timestamptz,
  completed_on_time     boolean,
  reviewed_by           uuid references public.profiles(id),
  source                text not null default 'app' check (source in ('app', 'import')),
  import_key            text unique,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint deadline_pair check (current_deadline is null or original_deadline is not null),
  constraint start_before_deadline check (start_date is null or original_deadline is null or start_date <= original_deadline)
);

create index tasks_assignee_idx   on public.tasks(assignee_id);
create index tasks_status_idx     on public.tasks(status);
create index tasks_project_idx    on public.tasks(project_id);
create index tasks_department_idx on public.tasks(department_id);
create index tasks_deadline_idx   on public.tasks(current_deadline);
create index tasks_batch_idx      on public.tasks(batch_id);

-- ---------- Assignment / handover history -----------------------------
create table public.task_assignments (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references public.tasks(id),
  from_profile_id  uuid references public.profiles(id),
  to_profile_id    uuid not null references public.profiles(id),
  assigned_by      uuid not null references public.profiles(id),
  kind             text not null check (kind in ('assign', 'reassign')),
  note             text,
  response         text not null default 'pending' check (response in ('pending', 'accepted', 'rejected', 'superseded')),
  response_reason  text,
  responded_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index task_assignments_task_idx on public.task_assignments(task_id);
create index task_assignments_to_idx   on public.task_assignments(to_profile_id);

-- ---------- Deadline extension requests -------------------------------
create table public.extension_requests (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references public.tasks(id),
  requested_by        uuid not null references public.profiles(id),
  original_deadline   date not null,        -- snapshot of task.original_deadline
  previous_deadline   date not null,        -- snapshot of task.current_deadline at request time
  requested_deadline  date not null,
  reason              text not null check (length(trim(reason)) >= 5),
  notes               text,
  progress_at_request integer,
  status              public.extension_status not null default 'pending',
  decided_by          uuid references public.profiles(id),
  decided_at          timestamptz,
  decision_reason     text,
  created_at          timestamptz not null default now(),
  constraint ext_date_after check (requested_deadline > previous_deadline)
);
create index extension_requests_task_idx   on public.extension_requests(task_id);
create index extension_requests_status_idx on public.extension_requests(status);
-- only one pending request per task at a time
create unique index extension_one_pending on public.extension_requests(task_id) where status = 'pending';

-- ---------- Comments & attachments ------------------------------------
create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id),
  author_id  uuid not null references public.profiles(id),
  kind       text not null default 'comment' check (kind in ('comment', 'progress', 'note')),
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments(task_id);

create table public.attachments (
  id                   uuid primary key default gen_random_uuid(),
  task_id              uuid not null references public.tasks(id),
  extension_request_id uuid references public.extension_requests(id),
  uploaded_by          uuid not null references public.profiles(id),
  file_name            text not null,
  storage_path         text not null unique,
  mime_type            text,
  size_bytes           bigint,
  created_at           timestamptz not null default now()
);
create index attachments_task_idx on public.attachments(task_id);

-- ---------- Notifications ---------------------------------------------
create table public.notifications (
  id                   uuid primary key default gen_random_uuid(),
  recipient_id         uuid not null references public.profiles(id) on delete cascade,
  type                 text not null,
  task_id              uuid references public.tasks(id),
  extension_request_id uuid references public.extension_requests(id),
  actor_id             uuid references public.profiles(id),
  data                 jsonb not null default '{}'::jsonb,
  is_read              boolean not null default false,
  dedupe_key           text unique,
  created_at           timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_id, is_read, created_at desc);

-- ---------- Activity log (append-only) --------------------------------
create table public.activity_log (
  id         bigserial primary key,
  task_id    uuid references public.tasks(id),
  actor_id   uuid references public.profiles(id),
  action     text not null,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_task_idx    on public.activity_log(task_id, created_at);
create index activity_log_created_idx on public.activity_log(created_at desc);

-- ---------- Import runs & settings ------------------------------------
create table public.import_runs (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles(id),
  source_name text,
  summary     jsonb not null default '{}'::jsonb,
  errors      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create table public.app_settings (
  key   text primary key,
  value jsonb not null
);
