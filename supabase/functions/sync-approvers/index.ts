/**
 * sync-approvers: Syncs Azure AD users into the approvers table.
 * Uses MS Graph /users endpoint with application permissions.
 *
 * Triggered by: daily Supabase cron OR manual POST from admin UI.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { getGraphToken } from '../_shared/graph-client.ts';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

interface AzureUser {
  id: string;
  mail: string | null;
  userPrincipalName: string;
  displayName: string;
  department: string | null;
  accountEnabled: boolean;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const token = await getGraphToken();
    let nextUrl: string | null =
      `${GRAPH_BASE}/users?$select=id,mail,userPrincipalName,displayName,department,accountEnabled&$top=999`;
    const allUsers: AzureUser[] = [];

    // Handle pagination
    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Graph users fetch failed: ${res.status}`);
      }
      const data = await res.json();
      allUsers.push(...(data.value ?? []));
      nextUrl = data['@odata.nextLink'] ?? null;
    }

    let upserted = 0;
    let deactivated = 0;

    const activeIds = new Set<string>();

    for (const user of allUsers) {
      const email = user.mail ?? user.userPrincipalName;
      if (!email) continue;

      activeIds.add(user.id);

      const { error } = await supabaseAdmin
        .from('approvers')
        .upsert(
          {
            azure_oid: user.id,
            email: email.toLowerCase(),
            display_name: user.displayName,
            department: user.department ?? null,
            is_active: user.accountEnabled,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'azure_oid' },
        );

      if (error) {
        console.error(`Upsert failed for ${email}:`, error.message);
      } else {
        upserted++;
      }
    }

    // Deactivate users no longer returned by Graph
    const { data: existing } = await supabaseAdmin
      .from('approvers')
      .select('id, azure_oid')
      .eq('is_active', true);

    for (const row of existing ?? []) {
      if (!activeIds.has(row.azure_oid)) {
        await supabaseAdmin
          .from('approvers')
          .update({ is_active: false })
          .eq('id', row.id);
        deactivated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, upserted, deactivated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
