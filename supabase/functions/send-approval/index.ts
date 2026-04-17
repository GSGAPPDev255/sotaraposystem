/**
 * send-approval: Sends an approval request email when a PO is marked
 * "Ready for Approval". Uses MS Graph sendMail API.
 *
 * Triggered by: frontend when finance changes status to pending_approval.
 * Expects: { purchase_order_id: string } in POST body.
 * Requires: finance user auth token.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin, createUserClient } from '../_shared/supabase-client.ts';
import { sendMail } from '../_shared/graph-client.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const userClient = createUserClient(req);
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { purchase_order_id } = await req.json();
  if (!purchase_order_id) {
    return new Response(JSON.stringify({ error: 'purchase_order_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch PO with approver details
    const { data: po, error: poError } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        approver:approvers!assigned_approver_id (id, email, display_name),
        second_approver:approvers!second_approver_id (id, email, display_name)
      `)
      .eq('id', purchase_order_id)
      .single();

    if (poError || !po) {
      throw new Error(`PO not found: ${poError?.message}`);
    }

    if (po.status !== 'pending_approval') {
      throw new Error(`PO status must be pending_approval, got ${po.status}`);
    }

    if (!po.approver) {
      throw new Error('No approver assigned to this PO');
    }

    const frontendUrl = Deno.env.get('FRONTEND_URL')!;
    const approveUrl = `${frontendUrl}/approve/${purchase_order_id}`;
    const financeMailbox = Deno.env.get('FINANCE_MAILBOX')!;

    const grossFormatted = po.gross_amount != null
      ? `£${Number(po.gross_amount).toFixed(2)}`
      : 'Not set';

    const emailHtml = buildApprovalEmail({
      approverName: po.approver.display_name,
      supplierName: po.supplier_name ?? 'Unknown Supplier',
      invoiceRef: po.transaction_reference ?? 'N/A',
      grossAmount: grossFormatted,
      transactionDate: po.transaction_date ?? 'N/A',
      financeNotes: po.finance_notes ?? '',
      approveUrl,
    });

    const recipients = [{ emailAddress: { address: po.approver.email, name: po.approver.display_name } }];
    if (po.second_approver) {
      recipients.push({ emailAddress: { address: po.second_approver.email, name: po.second_approver.display_name } });
    }

    await sendMail(financeMailbox, {
      message: {
        subject: `Invoice Approval Required: ${po.supplier_name ?? ''} — ${po.transaction_reference ?? purchase_order_id}`,
        body: { contentType: 'HTML', content: emailHtml },
        toRecipients: recipients,
      },
      saveToSentItems: true,
    });

    // Update PO approval_sent_at
    await supabaseAdmin
      .from('purchase_orders')
      .update({ approval_sent_at: new Date().toISOString() })
      .eq('id', purchase_order_id);

    // Audit log
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, display_name')
      .eq('id', user.id)
      .single();

    await supabaseAdmin.from('audit_log').insert({
      purchase_order_id,
      action: 'approval_sent',
      actor_id: user.id,
      actor_email: profile?.email ?? user.email,
      actor_display: profile?.display_name,
      new_values: {
        sent_to: recipients.map((r) => r.emailAddress.address),
        approval_sent_at: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ success: true }), {
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

function buildApprovalEmail(opts: {
  approverName: string;
  supplierName: string;
  invoiceRef: string;
  grossAmount: string;
  transactionDate: string;
  financeNotes: string;
  approveUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #1e3a5f; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Invoice Approval Required</h1>
  </div>
  <div style="border: 1px solid #ddd; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
    <p>Dear ${opts.approverName},</p>
    <p>An invoice requires your approval. Please review the details below and take action.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background: #f5f5f5;">
        <td style="padding: 10px; font-weight: bold; width: 40%;">Supplier</td>
        <td style="padding: 10px;">${opts.supplierName}</td>
      </tr>
      <tr>
        <td style="padding: 10px; font-weight: bold;">Invoice Reference</td>
        <td style="padding: 10px;">${opts.invoiceRef}</td>
      </tr>
      <tr style="background: #f5f5f5;">
        <td style="padding: 10px; font-weight: bold;">Invoice Date</td>
        <td style="padding: 10px;">${opts.transactionDate}</td>
      </tr>
      <tr>
        <td style="padding: 10px; font-weight: bold;">Gross Amount</td>
        <td style="padding: 10px; font-size: 18px; font-weight: bold; color: #1e3a5f;">${opts.grossAmount}</td>
      </tr>
      ${opts.financeNotes ? `<tr style="background: #f5f5f5;">
        <td style="padding: 10px; font-weight: bold;">Finance Notes</td>
        <td style="padding: 10px;">${opts.financeNotes}</td>
      </tr>` : ''}
    </table>

    <p style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; font-size: 13px;">
      <strong>Important:</strong> You are approving the spend, not verifying the invoice data accuracy.
      Finance has validated all invoice details.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${opts.approveUrl}" style="display: inline-block; background: #1e3a5f; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
        Review &amp; Respond to Invoice
      </a>
    </div>

    <p style="color: #666; font-size: 12px;">
      This link will require your Microsoft 365 login. If you were not expecting this email, please contact the finance team.
    </p>
  </div>
</body>
</html>`;
}
