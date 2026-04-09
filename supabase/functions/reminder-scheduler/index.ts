/**
 * reminder-scheduler: Sends reminder emails to approvers who have not acted
 * on invoices within the configured REMINDER_DAYS threshold.
 *
 * Triggered by: Supabase cron (daily at 08:00 UTC).
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { sendMail } from '../_shared/graph-client.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const reminderDays = parseInt(Deno.env.get('REMINDER_DAYS') ?? '3', 10);
  const financeMailbox = Deno.env.get('FINANCE_MAILBOX')!;
  const frontendUrl = Deno.env.get('FRONTEND_URL')!;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - reminderDays);

  try {
    // Fetch overdue pending-approval POs
    const { data: overduePos, error } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        id, supplier_name, transaction_reference, gross_amount,
        approval_sent_at, transaction_date,
        approver:assigned_approver_id (email, display_name),
        second_approver:second_approver_id (email, display_name)
      `)
      .eq('status', 'pending_approval')
      .lt('approval_sent_at', cutoff.toISOString());

    if (error) throw new Error(error.message);

    let sent = 0;
    const errors: string[] = [];

    for (const po of overduePos ?? []) {
      if (!po.approver) continue;

      try {
        // Count previous reminders
        const { count: reminderCount } = await supabaseAdmin
          .from('reminders')
          .select('id', { count: 'exact', head: true })
          .eq('purchase_order_id', po.id);

        const nextReminderNumber = (reminderCount ?? 0) + 1;
        const approveUrl = `${frontendUrl}/approve/${po.id}`;
        const grossFormatted = po.gross_amount != null
          ? `£${Number(po.gross_amount).toFixed(2)}`
          : 'Not set';

        const html = buildReminderEmail({
          approverName: po.approver.display_name,
          supplierName: po.supplier_name ?? 'Unknown',
          invoiceRef: po.transaction_reference ?? po.id,
          grossAmount: grossFormatted,
          reminderNumber: nextReminderNumber,
          daysPending: reminderDays * nextReminderNumber,
          approveUrl,
        });

        const recipients = [
          { emailAddress: { address: po.approver.email, name: po.approver.display_name } },
        ];
        if (po.second_approver) {
          recipients.push({
            emailAddress: { address: po.second_approver.email, name: po.second_approver.display_name },
          });
        }

        await sendMail(financeMailbox, {
          message: {
            subject: `[Reminder #${nextReminderNumber}] Invoice Approval Pending: ${po.supplier_name ?? ''} — ${po.transaction_reference ?? po.id}`,
            body: { contentType: 'HTML', content: html },
            toRecipients: recipients,
          },
          saveToSentItems: false,
        });

        // Insert reminder record
        for (const recipient of recipients) {
          await supabaseAdmin.from('reminders').insert({
            purchase_order_id: po.id,
            sent_to_email: recipient.emailAddress.address,
            reminder_number: nextReminderNumber,
          });
        }

        // Audit log
        await supabaseAdmin.from('audit_log').insert({
          purchase_order_id: po.id,
          action: 'reminder_sent',
          actor_email: 'system@reminder-scheduler',
          actor_display: 'Reminder Scheduler (System)',
          metadata: {
            reminder_number: nextReminderNumber,
            sent_to: recipients.map((r) => r.emailAddress.address),
          },
        });

        sent++;
      } catch (poErr) {
        errors.push(`PO ${po.id}: ${(poErr as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: sent, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function buildReminderEmail(opts: {
  approverName: string;
  supplierName: string;
  invoiceRef: string;
  grossAmount: string;
  reminderNumber: number;
  daysPending: number;
  approveUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#dc3545;padding:16px;border-radius:8px 8px 0 0;">
    <h2 style="color:white;margin:0;font-size:18px;">⏰ Reminder #${opts.reminderNumber}: Invoice Approval Pending</h2>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p>Dear ${opts.approverName},</p>
    <p>This is a reminder that the following invoice has been awaiting your approval for <strong>${opts.daysPending} days</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f5f5f5;"><td style="padding:10px;font-weight:bold;width:40%;">Supplier</td><td style="padding:10px;">${opts.supplierName}</td></tr>
      <tr><td style="padding:10px;font-weight:bold;">Invoice Reference</td><td style="padding:10px;">${opts.invoiceRef}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:10px;font-weight:bold;">Gross Amount</td><td style="padding:10px;font-size:16px;font-weight:bold;">${opts.grossAmount}</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0;">
      <a href="${opts.approveUrl}" style="display:inline-block;background:#1e3a5f;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">Review &amp; Respond Now</a>
    </div>
    <p style="color:#666;font-size:12px;">If you have already taken action, please ignore this reminder. Contact the finance team if you have questions.</p>
  </div>
</body>
</html>`;
}
