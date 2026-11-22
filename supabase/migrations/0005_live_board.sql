-- =====================================================================
-- 0005: Live Kanban board — broadcast task changes to signed-in viewers.
-- Safe to run more than once. Realtime still applies each viewer's RLS,
-- so people only receive changes for tasks they are allowed to see.
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object or undefined_object then null; end $$;
