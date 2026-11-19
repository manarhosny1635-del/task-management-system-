// End-to-end tests of the database layer (schema + RLS + workflow functions)
// against a real Postgres engine (PGlite), with Supabase's auth schema stubbed.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const dir = new URL('../supabase/migrations/', import.meta.url);
const db = new PGlite();
let passed = 0, failed = 0;
const ok = (cond, name) => { if (cond) { passed++; console.log('  ✓', name); } else { failed++; console.log('  ✗', name); } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
for (const f of ['0001_schema.sql', '0002_functions.sql', '0003_security_views_seed.sql']) {
  await db.exec(readFileSync(new URL(f, dir), 'utf8'));
}
console.log('migrations applied');

// run SQL as a signed-in user (RLS + grants apply)
async function as(uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return await db.query(sql, params); }
  finally { await db.exec('reset role;'); }
}
async function expectErr(p, key, name) {
  try { await p; ok(false, `${name} (expected ${key}, got success)`); }
  catch (e) { ok(String(e.message).includes(key), `${name} → ${e.message}`); }
}
const one = async (uid, sql, params) => (await as(uid, sql, params)).rows[0];
const su = async (sql, params) => (await db.query(sql, params)).rows;

// ---------- users ---------------------------------------------------
const mk = async (email) => (await su(`insert into auth.users(email) values ($1) returning id`, [email]))[0].id;
const U = { admin: await mk('admin@x.com'), leader: await mk('lead@x.com'), ahmed: await mk('ahmed@x.com'),
            sara: await mk('sara@x.com'), omar: await mk('omar@x.com') };
const P = {};
P.admin = (await su(`select public.bootstrap_admin($1,'منار حسني','admin@x.com') id`, [U.admin]))[0].id;

console.log('\n1. Team setup by admin');
const dev = (await one(U.admin, `select public.save_department(null,'التطوير','',null) id`)).id;
const ops = (await one(U.admin, `select public.save_department(null,'التشغيل','',null) id`)).id;
for (const [k, name, dept] of [['leader','قائد الفريق',dev],['ahmed','أحمد وائل',dev],['sara','سارة',dev],['omar','عمر',ops]]) {
  P[k] = (await one(U.admin, `select public.save_profile(null, $1::jsonb) id`, [JSON.stringify({ full_name: name, department_id: dept })])).id;
  await as(U.admin, `select public.link_member_login($1,$2,$3)`, [P[k], U[k], `${k}@x.com`]);
}
await as(U.admin, `select public.save_department($1,'التطوير','',$2)`, [dev, P.leader]);
ok((await su(`select role from profiles where id=$1`, [P.leader]))[0].role === 'team_leader', 'department leader promoted to team_leader');
await expectErr(as(U.ahmed, `select public.save_profile(null,'{"full_name":"x"}')`), 'err.not_allowed', 'employee cannot add members');
await expectErr(as(U.admin, `select public.save_profile($1,'{"full_name":"منار","role":"employee"}')`, [P.admin]), 'err.cannot_demote_self', 'admin cannot demote self');

console.log('\n2. Batch creation — multiple independent tasks');
const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const batch = await one(U.admin, `select public.create_tasks($1::jsonb) r`, [JSON.stringify({ title: 'دفعة نوفمبر', rows: [
  { title: 'Review homepage UI', assignee_id: P.ahmed, priority: 'high', deadline: d(3) },
  { title: 'Prepare user guide', assignee_id: P.ahmed, priority: 'medium', deadline: d(5) },
  { title: 'Review mobile responsiveness', assignee_id: P.ahmed, priority: 'high', deadline: d(6) },
  { title: 'Data entry', assignee_id: P.sara, deadline: d(4), requires_review: false },
] })]);
const ids = batch.r.tasks.map(t => t.id);
ok(ids.length === 4 && new Set(batch.r.tasks.map(t => t.code)).size === 4, '4 separate records with unique codes');
ok((await su(`select count(*)::int c from tasks where batch_id=$1`, [batch.r.batch_id]))[0].c === 4, 'all linked to one batch');
ok((await su(`select count(*)::int c from tasks where assignee_id=$1 and status='pending_acceptance'`, [P.ahmed]))[0].c === 3, 'Ahmed has 3 pending acceptance');
ok((await su(`select count(*)::int c from notifications where recipient_id=$1 and type='task_assigned'`, [P.ahmed]))[0].c === 3, 'Ahmed got 3 assignment notifications');
await expectErr(as(U.admin, `select public.create_tasks($1::jsonb)`, [JSON.stringify({ rows: [{ title: '', deadline: d(2) }] })]), 'err.row_title_required|1', 'row validation: empty title');
await expectErr(as(U.admin, `select public.create_tasks($1::jsonb)`, [JSON.stringify({ rows: [{ title: 'x' }] })]), 'err.row_deadline_required', 'row validation: deadline required');
await expectErr(as(U.ahmed, `select public.create_tasks($1::jsonb)`, [JSON.stringify({ rows: [{ title: 'x', deadline: d(2) }] })]), 'err.not_allowed', 'employee cannot create tasks');
await expectErr(as(U.leader, `select public.create_tasks($1::jsonb)`, [JSON.stringify({ rows: [{ title: 'x', assignee_id: P.omar, deadline: d(2) }] })]), 'err.assignee_outside_team', 'leader cannot assign outside team');
const leaderTask = await one(U.leader, `select public.create_tasks($1::jsonb) r`, [JSON.stringify({ rows: [{ title: 'Leader task', assignee_id: P.sara, deadline: d(2) }] })]);
ok(!!leaderTask.r.tasks[0].id, 'leader can assign inside team');

console.log('\n3. Acceptance workflow');
const [t1, t2, t3, t4] = ids;
await expectErr(as(U.ahmed, `select public.transition_task($1,'start')`, [t1]), 'err.invalid_transition', 'cannot start before accepting');
await as(U.ahmed, `select public.respond_to_assignment($1,true)`, [t1]);
ok((await su(`select status,acceptance from tasks where id=$1`, [t1]))[0].status === 'accepted', 'accepted');
await expectErr(as(U.ahmed, `select public.respond_to_assignment($1,false,'')`, [t2]), 'err.reason_required', 'rejection needs reason');
await as(U.ahmed, `select public.respond_to_assignment($1,false,'عندي ضغط شغل')`, [t2]);
const r2 = (await su(`select status, assignee_id, acceptance from tasks where id=$1`, [t2]))[0];
ok(r2.status === 'declined' && r2.assignee_id === null, 'rejected task returns to management (unassigned)');
ok((await su(`select count(*)::int c from notifications where recipient_id=$1 and type='task_rejected'`, [P.admin]))[0].c === 1, 'admin notified of rejection');
ok((await as(U.ahmed, `select count(*)::int c from tasks where id=$1`, [t2])).rows[0].c === 1, 'Ahmed still sees the task he rejected (history)');
await expectErr(as(U.sara, `select public.respond_to_assignment($1,true)`, [t1]), 'err.not_assignee', 'others cannot accept someone else\'s task');

console.log('\n4. Reassignment keeps history');
await as(U.admin, `select public.assign_task($1,$2,'إعادة إسناد')`, [t2, P.sara]);
await as(U.admin, `select public.assign_task($1,$2,null)`, [t3, P.sara]);
const h3 = await su(`select kind, response, from_profile_id, to_profile_id, assigned_by from task_assignments where task_id=$1 order by created_at`, [t3]);
ok(h3.length === 2 && h3[0].response === 'superseded' && h3[1].from_profile_id === P.ahmed && h3[1].to_profile_id === P.sara && h3[1].assigned_by === P.admin,
   'reassign records previous assignee, new assignee, who, and keeps old row');
const h2 = await su(`select response from task_assignments where task_id=$1 order by created_at`, [t2]);
ok(h2[0].response === 'rejected' && h2[1].response === 'pending', 'rejected handover kept, new one pending');
ok((await su(`select count(*)::int c from notifications where recipient_id=$1 and type='task_reassigned_away'`, [P.ahmed]))[0].c === 1, 'previous owner notified');
await as(U.sara, `select public.respond_to_assignment($1,true)`, [t3]);
ok((await su(`select status from tasks where id=$1`, [t3]))[0].status === 'accepted', 'new assignee can accept');

console.log('\n5. Deadline extensions');
await as(U.ahmed, `select public.transition_task($1,'start')`, [t1]);
await as(U.ahmed, `select public.update_progress($1,40,'خلصت الهيدر')`, [t1]);
const orig = (await su(`select original_deadline::text o, current_deadline::text c from tasks where id=$1`, [t1]))[0];
await expectErr(as(U.ahmed, `select public.request_extension($1,$2::date,'سبب كافي')`, [t1, d(1)]), 'err.new_deadline_must_be_later', 'new date must be later');
await expectErr(as(U.ahmed, `select public.request_extension($1,$2::date,'')`, [t1, d(10)]), 'err.reason_required', 'reason mandatory');
await expectErr(as(U.sara, `select public.request_extension($1,$2::date,'سبب كافي')`, [t1, d(10)]), 'err.not_assignee', 'only assignee can request');
const e1 = (await one(U.ahmed, `select public.request_extension($1,$2::date,'العميل غيّر المتطلبات','') id`, [t1, d(10)])).id;
ok((await su(`select current_deadline::text c from tasks where id=$1`, [t1]))[0].c === orig.c, 'pending request does NOT change deadline');
await expectErr(as(U.ahmed, `select public.request_extension($1,$2::date,'سبب تاني')`, [t1, d(12)]), 'err.pending_extension_exists', 'one pending request at a time');
await expectErr(as(U.ahmed, `select public.decide_extension($1,true)`, [e1]), 'err.cannot_approve_own', 'employee cannot approve own request');
await expectErr(as(U.leader, `select public.decide_extension($1,true)`, [e1]), 'err.not_allowed', 'leader without permission cannot approve');
await expectErr(as(U.ahmed, `select public.update_task($1,$2::jsonb)`, [t1, JSON.stringify({ deadline: d(20) })]), 'err.not_allowed', 'employee cannot change deadline directly');
await as(U.admin, `select public.set_member_permission($1,'extensions.approve',true)`, [P.leader]);
await as(U.leader, `select public.decide_extension($1,true,'موافق')`, [e1]);
const after = (await su(`select original_deadline::text o, current_deadline::text c from tasks where id=$1`, [t1]))[0];
ok(after.c === d(10) && after.o === orig.o, 'approval moves current deadline; original preserved');
const e1row = (await su(`select status, decided_by from extension_requests where id=$1`, [e1]))[0];
ok(e1row.status === 'approved' && e1row.decided_by === P.leader, 'approver recorded');
ok((await su(`select count(*)::int c from notifications where recipient_id=$1 and type='extension_approved'`, [P.ahmed]))[0].c === 1, 'employee notified of approval');
await expectErr(as(U.admin, `select public.decide_extension($1,false,'لا')`, [e1]), 'err.request_already_decided', 'cannot decide twice');
const e2 = (await one(U.ahmed, `select public.request_extension($1,$2::date,'محتاج يومين كمان') id`, [t1, d(12)])).id;
await expectErr(as(U.admin, `select public.decide_extension($1,false,'')`, [e2]), 'err.reason_required', 'rejection needs reason');
await as(U.admin, `select public.decide_extension($1,false,'الموعد نهائي مع العميل')`, [e2]);
ok((await su(`select current_deadline::text c from tasks where id=$1`, [t1]))[0].c === d(10), 'rejection keeps deadline unchanged');
const ov = (await as(U.admin, `select previous_requests from extension_overview where id=$1`, [e2])).rows[0];
ok(ov.previous_requests === 1, 'multiple requests kept; history visible to reviewer');
await expectErr(su(`update tasks set original_deadline = current_date + 99 where id=$1`, [t1]), 'err.original_deadline_immutable', 'original deadline immutable even for DB owner');

console.log('\n6. Review & completion');
await as(U.ahmed, `select public.transition_task($1,'submit','جاهز')`, [t1]);
ok((await su(`select status from tasks where id=$1`, [t1]))[0].status === 'submitted', 'submitted for review');
await expectErr(as(U.ahmed, `select public.transition_task($1,'approve')`, [t1]), 'err.cannot_review_own', 'assignee cannot approve own work');
await expectErr(as(U.leader, `select public.transition_task($1,'request_changes','')`, [t1]), 'err.reason_required', 'changes request needs note');
await as(U.leader, `select public.transition_task($1,'request_changes','عدّل الألوان')`, [t1]);
await as(U.ahmed, `select public.transition_task($1,'start')`, [t1]);
await as(U.ahmed, `select public.transition_task($1,'submit')`, [t1]);
await as(U.leader, `select public.transition_task($1,'approve')`, [t1]);
const done = (await su(`select status, completed_on_time, progress from tasks where id=$1`, [t1]))[0];
ok(done.status === 'completed' && done.completed_on_time === true && done.progress === 100, 'completed on time');
await expectErr(as(U.admin, `select public.update_task($1,'{"title":"x"}')`, [t1]), 'err.task_locked', 'completed task cannot be edited');
await expectErr(as(U.ahmed, `select public.request_extension($1,$2::date,'سبب كافي')`, [t1, d(30)]), 'err.extension_not_allowed_in_status', 'no extension on completed task');
await as(U.sara, `select public.respond_to_assignment($1,true)`, [t4]);
await as(U.sara, `select public.transition_task($1,'start')`, [t4]);
ok((await one(U.sara, `select public.transition_task($1,'submit') s`, [t4])).s === 'completed', 'task without review completes on submit');

console.log('\n7. Visibility (RLS) & direct-write protection');
ok((await as(U.omar, `select count(*)::int c from tasks`)).rows[0].c === 0, 'employee in other dept sees no foreign tasks');
const leaderSees = (await as(U.leader, `select count(*)::int c from tasks`)).rows[0].c;
ok(leaderSees === 5, `leader sees all team tasks (${leaderSees})`);
ok((await as(U.sara, `select count(*)::int c from task_overview`)).rows[0].c === 4, 'Sara sees only her tasks');
await expectErr(as(U.admin, `update tasks set status='completed' where id=$1`, [t2]), 'permission denied', 'no direct UPDATE even for admin session');
await expectErr(as(U.ahmed, `insert into activity_log(action) values ('fake')`), 'permission denied', 'no direct INSERT into audit log');
await expectErr(as(U.ahmed, `select public.log_activity(null,'fake')`), 'permission denied', 'internal log function not callable');
await expectErr(su(`delete from activity_log`), 'err.audit_immutable', 'audit log cannot be deleted (even by owner)');
await expectErr(as(null, `select public.create_tasks('{}')`), 'permission denied', 'anonymous cannot call API');
await expectErr(as(U.ahmed, `select public.bootstrap_admin($1,'x','x')`, [U.ahmed]), 'permission denied', 'bootstrap not callable by users');

console.log('\n8. Dashboard numbers match database');
const byStatus = (await as(U.admin, `select status, count(*)::int c from task_overview group by 1`)).rows;
const raw = await su(`select status, count(*)::int c from tasks group by 1`);
ok(JSON.stringify(byStatus.sort((a, b) => a.status.localeCompare(b.status))) === JSON.stringify(raw.sort((a, b) => a.status.localeCompare(b.status))), 'admin view counts = table counts');
const timeline = (await as(U.admin, `select action from activity_overview where task_id=$1 order by id`, [t1])).rows.map(r => r.action);
ok(['task_created','task_assigned','assignment_accepted','status_changed','progress_updated','extension_requested','extension_approved','extension_rejected'].every(a => timeline.includes(a)), 'timeline has full journey: ' + timeline.join(', '));

console.log('\n9. Overdue & deadline notifications (idempotent)');
const late = await one(U.admin, `select public.create_tasks($1::jsonb) r`, [JSON.stringify({ rows: [{ title: 'late', assignee_id: P.sara, deadline: d(0) }] })]);
await su(`update tasks set current_deadline = current_date - 2 where id=$1`, [late.r.tasks[0].id]); // simulate time passing
await as(U.admin, `select public.import_sheet($1::jsonb)`, [JSON.stringify({ source_name: 't', employees: [], tasks: [{ import_key: 'late-1', title: 'old overdue', assignee_name: 'سارة', status: 'in_progress', deadline: d(-3), row: 99 }] })]);
await as(U.admin, `select public.run_deadline_checks()`);
const n1 = (await su(`select count(*)::int c from notifications where type='task_overdue' and recipient_id=$1`, [P.sara]))[0].c;
await as(U.admin, `select public.run_deadline_checks()`);
const n2 = (await su(`select count(*)::int c from notifications where type='task_overdue' and recipient_id=$1`, [P.sara]))[0].c;
ok(n1 === 2 && n2 === 2, `one overdue notice per overdue task, no repeats on re-run (${n1} → ${n2})`);
ok((await su(`select count(*)::int c from notifications where type='task_overdue' and recipient_id=$1`, [P.admin]))[0].c === 2, 'managers notified of overdue tasks');
ok((await as(U.admin, `select count(*)::int c from task_overview where is_overdue`)).rows[0].c >= 1, 'overdue flagged in overview');

console.log('\n10. Spreadsheet import (dedupe)');
const payload = { source_name: 'متابعة تاسكات', employees: [{ name: 'احمد وائل', row: 4 }, { name: 'محمد الشحات', row: 2 }],
  tasks: [{ import_key: 'r2-1', title: 'Pharmacy ERP Analysis', assignee_name: 'محمد الشحات', status: 'in_progress', assignment_date: '2026-10-27', deadline: '2026-11-15', notes: 'ممتد للقياس كتيم ليدر', row: 2 },
          { import_key: 'r4-q1', title: 'كوليكت اس', suggested_name: 'احمد وائل', status: 'new', row: 4 },
          { import_key: 'r9-1', title: 'x', assignee_name: 'شخص غير موجود', status: 'in_progress', row: 9 }] };
const imp1 = (await one(U.admin, `select public.import_sheet($1::jsonb) r`, [JSON.stringify(payload)])).r;
ok(imp1.employees_created === 1 && imp1.employees_existing === 1, 'existing employee matched despite أ/ا spelling');
ok(imp1.tasks_created === 2 && imp1.errors.length === 1, 'tasks imported; unknown assignee reported as error');
const imp2 = (await one(U.admin, `select public.import_sheet($1::jsonb) r`, [JSON.stringify(payload)])).r;
ok(imp2.tasks_created === 0 && imp2.tasks_duplicate === 2 && imp2.employees_created === 0, 're-import creates no duplicates');
const q = (await su(`select status, assignee_id, suggested_assignee_id from tasks where import_key='r4-q1'`))[0];
ok(q.status === 'new' && q.assignee_id === null && q.suggested_assignee_id === P.ahmed, 'queued task imported as New with suggested assignee');
await expectErr(as(U.leader, `select public.import_sheet('{}')`), 'err.not_allowed', 'only admins import');

console.log('\n11. Full import of the real spreadsheet');
{
  const XLSX = (await import('xlsx')).default;
  const mod = await import('../.tmp-sheetImport.mjs');
  const wb = XLSX.read(readFileSync(new URL('../data/sheet-export.csv', import.meta.url), 'utf8'), { type: 'string', raw: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  const payload = mod.toPayload(mod.buildPreview(rows, 2026), 'متابعة تاسكات');
  const r1 = (await one(U.admin, `select public.import_sheet($1::jsonb) r`, [JSON.stringify(payload)])).r;
  ok(r1.errors.length === 0, `sheet imported with no errors (${r1.tasks_created} tasks, ${r1.employees_created} new + ${r1.employees_existing} existing employees)`);
  const r2 = (await one(U.admin, `select public.import_sheet($1::jsonb) r`, [JSON.stringify(payload)])).r;
  ok(r2.tasks_created === 0 && r2.employees_created === 0, 'importing the sheet twice creates no duplicates');
  const shared = (await su(`select count(distinct assignee_id)::int c from tasks where title='اوسيل' and source='import'`))[0].c;
  ok(shared === 3, 'shared work → one task record per person (3)');
  const zyad = (await su(`select t.status, t.original_deadline::text d from tasks t join profiles p on p.id=t.assignee_id where p.full_name like 'زياد اشرف%' and t.title='مصايف'`))[0];
  ok(zyad?.status === 'completed' && zyad.d === '2026-11-02', 'finished work imported as completed with its deadline');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
