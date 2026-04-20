import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Service-role client — bypasses RLS. Use only inside Edge Functions. */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

/** Create a user-scoped client from the request's Authorization header. */
export function createUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  // Prefer SUPABASE_ANON_KEY; fall back to SUPABASE_PUBLISHABLE_KEY (newer Supabase
  // runtimes) and finally to the service-role key so auth never silently breaks
  // just because an env var was renamed. The Authorization header carries the
  // user's JWT, which is what actually identifies the caller.
  const apiKey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    serviceRoleKey;
  return createClient(supabaseUrl, apiKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * Verify the caller's JWT using the service-role admin client.
 * Works even when SUPABASE_ANON_KEY is missing/renamed in the runtime.
 * Returns { user, error } mirroring supabase.auth.getUser().
 */
export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return { user: null, error: new Error('Missing Authorization header') };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return { user: data?.user ?? null, error };
}
