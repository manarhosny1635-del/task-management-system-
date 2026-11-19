// Create the first admin login.
// Usage: node scripts/create-admin.mjs "<full name>" <email> <password>
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local or the environment.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env.local')) for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) { console.error('Usage: node scripts/create-admin.mjs "<full name>" <email> <password>'); process.exit(1); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error) { console.error('Auth error:', error.message); process.exit(1); }
const r = await sb.rpc('bootstrap_admin', { p_user: data.user.id, p_name: name, p_email: email });
if (r.error) { console.error('DB error:', r.error.message); await sb.auth.admin.deleteUser(data.user.id); process.exit(1); }
console.log('✓ Admin created:', name, email);
