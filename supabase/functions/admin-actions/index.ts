/**
 * admin-actions: Admin-only operations that require the service role key.
 *
 * Actions:
 *   invite_user   — Creates a Supabase auth user, sends invite email, pre-creates profile
 *   update_user   — Updates a profile's display_name / role
 *   search_gal    — Searches Azure AD for users by display name or email
 *   add_approver  — Adds or reactivates an approver from Azure AD
 *
 * All actions require the caller to be an authenticated admin.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { searchUsers, type AzureAdUser } from '../_shared/graph-client.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  // Verify caller is an authenticated admin — verbose errors to aid debugging
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return json({ error: 'Unauthorized: missing Authorization header' }, 401);
  }

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user) {
    return json({
      error: 'Unauthorized: token rejected by Supabase Auth',
      detail: authError?.message ?? 'no user returned',
      token_length: token.length,
      token_prefix: token.slice(0, 12),
    }, 401);
  }
  const user = userData.user;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    return json({
      error: 'Profile lookup failed',
      detail: profileError.message,
      user_id: user.id,
      user_email: user.email,
    }, 500);
  }

  if (profile?.role !== 'admin') {
    return json({
      error: 'Forbidden: admin role required',
      your_role: profile?.role ?? 'none',
      user_email: user.email,
    }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { action } = body;

  try {
    // ── Invite User ────────────────────────────────────────────────────────
    if (action === 'invite_user') {
      const email        = String(body.email ?? '').trim().toLowerCase();
      const display_name = String(body.display_name ?? '').trim();
      const role         = String(body.role ?? 'finance');

      if (!email || !display_name) {
        return json({ error: 'email and display_name are required' }, 400);
      }

      const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://yourdomain.com';

      // Create auth user and send invite email
      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { display_name, preferred_role: role },
          redirectTo: `${frontendUrl}/dashboard`,
        });

      if (inviteError) throw new Error(inviteError.message);

      // Pre-create profile with the correct role so it's ready on first sign-in
      if (inviteData?.user) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id:           inviteData.user.id,
            email:        email,
            display_name: display_name,
            role:         role,
            is_active:    true,
          }, { onConflict: 'id' });

        if (profileError) {
          console.warn('Profile pre-create warning:', profileError.message);
        }
      }

      return json({ success: true, message: `Invitation sent to ${email}` });
    }

    // ── Update User ────────────────────────────────────────────────────────
    if (action === 'update_user') {
      const id           = String(body.id ?? '');
      const display_name = String(body.display_name ?? '').trim();
      const role         = String(body.role ?? '');

      if (!id) return json({ error: 'id is required' }, 400);

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (display_name) updates.display_name = display_name;
      if (role)         updates.role         = role;

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', id);

      if (error) throw new Error(error.message);
      return json({ success: true });
    }

    // ── Search GAL ─────────────────────────────────────────────────────────
    if (action === 'search_gal') {
      const query = String(body.query ?? '').trim();

      if (!query || query.length < 2) {
        return json({ error: 'query must be at least 2 characters' }, 400);
      }

      const users = await searchUsers(query);
      return json({ users });
    }

    // ── Add Approver ───────────────────────────────────────────────────────
    if (action === 'add_approver') {
      const azure_oid    = String(body.azure_oid ?? '').trim();
      const email        = String(body.email ?? '').trim().toLowerCase();
      const display_name = String(body.display_name ?? '').trim();
      const department   = String(body.department ?? '').trim();

      if (!azure_oid || !email || !display_name) {
        return json({ error: 'azure_oid, email, and display_name are required' }, 400);
      }

      // Upsert approver — allows reactivation if previously deactivated
      const { data: approver, error: upsertError } = await supabaseAdmin
        .from('approvers')
        .upsert({
          azure_oid,
          email,
          display_name,
          department,
          is_active: true,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'azure_oid' });

      if (upsertError) {
        throw new Error(`Failed to add approver: ${upsertError.message}`);
      }

      return json({ success: true, approver });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error('admin-actions error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
