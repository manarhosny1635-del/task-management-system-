-- =====================================================================
-- 0004: Supabase platform features (storage, realtime, scheduled checks)
-- Run after 0001–0003. Requires the Supabase project (not plain Postgres).
-- =====================================================================

-- ---------- Private storage bucket for task attachments --------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)   -- 25 MB per file
on conflict (id) do nothing;

-- path convention: tasks/<task_id>/<uuid>-<file name>
create policy "attachments read for task viewers" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments'
         and (storage.foldername(name))[1] = 'tasks'
         and public.can_view_task(((storage.foldername(name))[2])::uuid));

create policy "attachments upload for task viewers" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments'
              and (storage.foldername(name))[1] = 'tasks'
              and public.can_view_task(((storage.foldername(name))[2])::uuid));
-- no update / delete policy → uploaded evidence cannot be altered or removed by users

-- ---------- Realtime for the notification bell -----------------------
alter publication supabase_realtime add table public.notifications;

-- ---------- Hourly deadline checks (approaching / overdue) -----------
create extension if not exists pg_cron;
select cron.schedule('taskflow-deadline-checks', '5 * * * *', $$select public.run_deadline_checks()$$);
