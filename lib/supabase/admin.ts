import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Service-role client — server only, used exclusively to create login accounts. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
