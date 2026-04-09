/**
 * process-approval: Records an approver's decision (approve/reject/forward)
 * on a purchase order. Called from the frontend ApproverView page.
 *
 * Requires: approver's Azure AD auth token.
 * POST body: { purchase_order_id, action: 'approve'|'reject'|'forward', comment?, forward_to_approver_id? }
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin, createUserClient } from '../_shared/supabase-client.ts';
import { sendMail } from '../_shared/graph-client.ts';

type ApprovalAction = 'approve' | 'reject' | 'forward';

interface ApprovalPayload {
  purchase_order_id: string;
  action: ApprovalAction;
  comment?: string;
  forward_to_approver_id?: string;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  // Authenticate the approver
  const userClient = createUserClient(req);
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: ApprovalPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { purchase_order_id, action, comment, forward_to_approver_id } = payload;

  if (!purchase_order_id || !action) {
    return new Response(JSON.stringify({ error: 'purchase_order_id and action required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (action === 'reject' && !comment) {
    return new Response(JSON.stringify({ error: 'comment is required for rejection' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (action === 'forward' && !forward_to_approver_id) {
    return new Response(JSON.stringify({ error: 'forward_to_approver_id is required for forwarding' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch PO
    const { data: po, error: poError } = await supabaseAdmin
      .from('purchase_orders')
      .select('*, approver:assigned_approver_id(email, display_name)')
      .eq('id', purchase_order_id)
      .single();

    if (poError || !po) {
      throw new Error('PO not found');
    }

    if (po.status !== 'pending_approval') {
      throw new Error(`PO is not pending approval (current status: ${po.status})`);
    }

    // Verify the acting user is the assigned approver
    const { data: approverRow } = await supabaseAdmin
      .from('approvers')
      .select('id')
      .eq('email', user.email!.toLowerCase())
      .single();

    const isAssignedApprover =
      po.assigned_approver_id === approverRow?.id ||
      po.second_approver_id === approverRow?.id;

    if (!isAssignedApprover) {
      return new Response(JSON.stringify({ error: 'You are not the assigned approver for this invoice' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch actor profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, display_name')
      .eq('id', user.id)
      .single();

    const now = new Date().toISOString();

    if (action === 'approve') {
      await supabaseAdmin.from('purchase_orders').update({
        status: 'approved',
        approved_by_id: user.id,
        approved_at: now,
        approver_comments: comment ?? null,
        updated_by_id: user.id,
      }).eq('id', purchase_order_id);

      await supabaseAdmin.from('audit_log').insert({
        purchase_order_id,
        action: 'approved',
        actor_id: user.id,
        actor_email: profile?.email ?? user.email,
        actor_display: profile?.display_name,
        new_values: { status: 'approved', comment, approved_at: now },
      });

      // Notify finance team
      await notifyFinance(po, 'approved', profile?.display_name ?? user.email!, comment);

    } else if (action === 'reject') {
      await supabaseAdmin.from('purchase_orders').update({
        status: 'rejected',
        rejected_reason: comment,
        updated_by_id: user.id,
      }).eq('id', purchase_order_id);

      await supabaseAdmin.from('audit_log').insert({
        purchase_order_id,
        action: 'rejected',
        actor_id: user.id,
        actor_email: profile?.email ?? user.email,
        actor_display: profile?.display_name,
        new_values: { status: 'rejected', rejected_reason: comment },
      });

      await notifyFinance(po, 'rejected', profile?.display_name ?? user.email!, comment);

    } else if (action === 'forward') {
      const { data: newApprover } = await supabaseAdmin
        .from('approvers')
        .select('email, display_name')
        .eq('id', forward_to_approver_id)
        .single();

      if (!newApprover) throw new Error('Forward-to approver not found');

      await supabaseAdmin.from('purchase_orders').update({
        assigned_approver_id: forward_to_approver_id,
        forwarded_to_id: forward_to_approver_id,
        forwarded_reason: comment,
        approval_sent_at: null,
        updated_by_id: user.id,
      }).eq('id', purchase_order_id);

      await supabaseAdmin.from('audit_log').insert({
        purchase_order_id,
        action: 'forwarded',
        actor_id: user.id,
        actor_email: profile?.email ?? user.email,
        actor_display: profile?.display_name,
        old_values: { assigned_approver_id: po.assigned_approver_id },
        new_values: {
          assigned_approver_id: forward_to_approver_id,
          forwarded_reason: comment,
          forwarded_to: newApprover.email,
        },
      });

      // Retrigger approval email to new approver
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      await fetch(`${supabaseUrl}/functions/v1/send-approval`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purchase_order_id }),
      });
    }

    // Fetch and return updated PO
    const { data: updatedPo } = await supabaseAdmin
      .from('purchase_orders')
      .select('*')
      .eq('id', purchase_order_id)
      .single();

    return new Response(JSON.stringify({ success: true, purchase_order: updatedPo }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function notifyFinance(
  po: Record<string, unknown>,
  decision: 'approved' | 'rejected',
  approverName: string,
  comment?: string,
) {
  const financeMailbox = Deno.env.get('FINANCE_MAILBOX')!;
  const frontendUrl = Deno.env.get('FRONTEND_URL')!;

  const statusLabel = decision === 'approved' ? '✅ Approved' : '❌ Rejected';
  const color = decision === 'approved' ? '#28a745' : '#dc3545';

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h2 style="color:${color};">${statusLabel}</h2>
<p>Invoice <strong>${po.transaction_reference ?? po.id}</strong> from <strong>${po.supplier_name ?? 'Unknown'}</strong> has been <strong>${decision}</strong> by ${approverName}.</p>
${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ''}
<p><a href="${frontendUrl}/invoices/${po.id}">View Invoice</a></p>
</body></html>`;

  await sendMail(financeMailbox, {
    message: {
      subject: `Invoice ${statusLabel}: ${po.supplier_name ?? ''} — ${po.transaction_reference ?? po.id}`,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: financeMailbox } }],
    },
    saveToSentItems: false,
  });
}
