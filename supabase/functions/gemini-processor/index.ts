/**
 * gemini-processor: Downloads an invoice file from Supabase Storage,
 * sends it to Gemini 2.5 Pro for structured extraction, stores the
 * immutable OCR record, and pre-populates the PO with extracted values.
 *
 * Triggered by: email-intake (async POST) or manual trigger from frontend.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { extractInvoiceFields } from '../_shared/gemini-client.ts';

interface ProcessorPayload {
  purchase_order_id: string;
  invoice_file_id: string;
  storage_path: string;
  mime_type: string;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  let payload: ProcessorPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { purchase_order_id, invoice_file_id, storage_path, mime_type } = payload;

  try {
    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('invoices')
      .download(storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Storage download failed: ${downloadError?.message}`);
    }

    const fileBytes = new Uint8Array(await fileData.arrayBuffer());

    // Call Gemini 2.5 Pro
    const { fields, rawResponse, processingMs } = await extractInvoiceFields(
      fileBytes,
      mime_type,
    );

    // Insert immutable OCR extraction record
    const { error: ocrError } = await supabaseAdmin
      .from('ocr_extractions')
      .insert({
        purchase_order_id,
        invoice_file_id,
        gemini_model: 'gemini-2.5-pro',
        raw_response: rawResponse,
        extracted_fields: fields,
        processing_ms: processingMs,
      });

    if (ocrError) {
      throw new Error(`ocr_extractions insert failed: ${ocrError.message}`);
    }

    // Pre-populate PO fields (only null fields — never overwrite finance edits)
    const poUpdates: Record<string, unknown> = {};

    if (fields.supplier_name)    poUpdates.supplier_name          = fields.supplier_name;
    if (fields.account_number)   poUpdates.account_number         = fields.account_number;
    if (fields.supplier_ref)     poUpdates.supplier_ref           = fields.supplier_ref;
    if (fields.invoice_number)   poUpdates.transaction_reference  = fields.invoice_number;
    if (fields.po_number)        poUpdates.second_reference        = fields.po_number;
    if (fields.description)      poUpdates.description            = fields.description;
    if (fields.net_amount != null) poUpdates.net_amount           = fields.net_amount;
    if (fields.vat_amount != null) poUpdates.vat_amount           = fields.vat_amount;
    if (fields.gross_amount != null) poUpdates.gross_amount       = fields.gross_amount;
    if (fields.invoice_date)     poUpdates.transaction_date       = fields.invoice_date;
    if (fields.due_date)         poUpdates.due_date               = fields.due_date;

    if (Object.keys(poUpdates).length > 0) {
      // Only update fields that are still null on the PO
      const { data: currentPo } = await supabaseAdmin
        .from('purchase_orders')
        .select('*')
        .eq('id', purchase_order_id)
        .single();

      const filteredUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(poUpdates)) {
        if (currentPo && (currentPo as Record<string, unknown>)[key] == null) {
          filteredUpdates[key] = value;
        }
      }

      if (Object.keys(filteredUpdates).length > 0) {
        await supabaseAdmin
          .from('purchase_orders')
          .update(filteredUpdates)
          .eq('id', purchase_order_id);
      }
    }

    // Insert audit log entry
    await supabaseAdmin.from('audit_log').insert({
      purchase_order_id,
      action: 'ocr_completed',
      actor_email: 'system@gemini-processor',
      actor_display: 'Gemini 2.5 Pro (System)',
      new_values: fields,
      metadata: { processing_ms: processingMs, model: 'gemini-2.5-pro' },
    });

    return new Response(
      JSON.stringify({ success: true, fields, processing_ms: processingMs }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('gemini-processor error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
