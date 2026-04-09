/**
 * email-intake: Polls the finance M365 mailbox via MS Graph API,
 * downloads invoice attachments, creates draft PO records,
 * and triggers Gemini extraction.
 *
 * Triggered by: Supabase cron (every 5 minutes)
 * Also accepts POST for manual trigger or MS Graph change notifications.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import {
  getUnreadMessages,
  getMessageAttachments,
  markMessageRead,
} from '../_shared/graph-client.ts';

const SUPPORTED_MIME_TYPES: Record<string, boolean> = {
  'application/pdf': true,
  'image/jpeg': true,
  'image/jpg': true,
  'image/png': true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
  'application/vnd.ms-excel': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/msword': true,
};

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const financeMailbox = Deno.env.get('FINANCE_MAILBOX')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const results: { processed: number; errors: string[] } = {
    processed: 0,
    errors: [],
  };

  try {
    const { value: messages } = await getUnreadMessages(financeMailbox);

    for (const message of messages) {
      if (!message.hasAttachments) {
        await markMessageRead(financeMailbox, message.id);
        continue;
      }

      try {
        const { value: attachments } = await getMessageAttachments(
          financeMailbox,
          message.id,
        );

        const invoiceAttachments = attachments.filter(
          (a) => SUPPORTED_MIME_TYPES[a.contentType],
        );

        if (invoiceAttachments.length === 0) {
          await markMessageRead(financeMailbox, message.id);
          continue;
        }

        for (const attachment of invoiceAttachments) {
          const poId = crypto.randomUUID();
          const year = new Date().getFullYear();
          const month = String(new Date().getMonth() + 1).padStart(2, '0');
          const storagePath = `${year}/${month}/${poId}/${attachment.name}`;

          // Decode base64 attachment
          const bytes = Uint8Array.from(atob(attachment.contentBytes), (c) =>
            c.charCodeAt(0),
          );

          // Upload to Supabase Storage
          const { error: storageError } = await supabaseAdmin.storage
            .from('invoices')
            .upload(storagePath, bytes, {
              contentType: attachment.contentType,
              upsert: false,
            });

          if (storageError) {
            results.errors.push(
              `Storage upload failed for ${attachment.name}: ${storageError.message}`,
            );
            continue;
          }

          // Insert invoice_files record
          const { data: fileRecord, error: fileError } = await supabaseAdmin
            .from('invoice_files')
            .insert({
              id: crypto.randomUUID(),
              storage_path: storagePath,
              bucket_name: 'invoices',
              original_name: attachment.name,
              mime_type: attachment.contentType,
              file_size_bytes: attachment.size,
              email_from: message.from.emailAddress.address,
              email_date: message.receivedDateTime,
              email_subject: message.subject,
            })
            .select()
            .single();

          if (fileError || !fileRecord) {
            results.errors.push(`invoice_files insert failed: ${fileError?.message}`);
            continue;
          }

          // Insert draft purchase_order
          const { data: poRecord, error: poError } = await supabaseAdmin
            .from('purchase_orders')
            .insert({
              id: poId,
              invoice_file_id: fileRecord.id,
              status: 'pending_finance_review',
            })
            .select()
            .single();

          if (poError || !poRecord) {
            results.errors.push(`purchase_orders insert failed: ${poError?.message}`);
            continue;
          }

          // Insert audit log entry
          await supabaseAdmin.from('audit_log').insert({
            purchase_order_id: poId,
            action: 'created',
            actor_email: 'system@email-intake',
            actor_display: 'Email Intake (System)',
            new_values: {
              email_from: message.from.emailAddress.address,
              email_subject: message.subject,
              attachment_name: attachment.name,
            },
          });

          // Trigger Gemini processor asynchronously
          fetch(`${supabaseUrl}/functions/v1/gemini-processor`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              purchase_order_id: poId,
              invoice_file_id: fileRecord.id,
              storage_path: storagePath,
              mime_type: attachment.contentType,
            }),
          }).catch((e) =>
            console.error('Failed to trigger gemini-processor:', e),
          );

          results.processed++;
        }

        await markMessageRead(financeMailbox, message.id);
      } catch (msgErr) {
        results.errors.push(`Message ${message.id}: ${(msgErr as Error).message}`);
      }
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
