/**
 * generate-csv: Validates approved POs and generates a Sage 200 CSV.
 * Stores the CSV in Supabase Storage and links it to the PO records.
 *
 * POST body: { purchase_order_ids: string[] }
 * Requires: finance user auth token.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin, createUserClient } from '../_shared/supabase-client.ts';

// Exact Sage 200 CSV column headers — order matters
const SAGE_HEADERS = [
  'AccountNumber',
  'Supplier Name',
  'Supplier Ref',
  'Supplier Ref: Code',
  'TransactionReference',
  'SecondReference',
  'UniqueReferenceNumber',
  'Email From',
  'Email Date',
  'TransactionDate',
  'PostingDate',
  'DueDate',
  'Description',
  'GoodsValueInAccountCurrency',
  'GoodsValueInBaseCurrency',
  'TaxValue',
  'Gross Amount',
  'DocumentToBaseCurrencyRate',
  'DocumentToAccountCurrencyRate',
  'Source',
  'SYSTraderTranType',
  'UserNumber',
  'QueryCode',
  'SYSTraderGenerationReasonType',
  'NominalAnalysisTransactionValue/1',
  'NominalAnalysisNominalAccountNumber/1',
  'NominalAnalysisNominalCostCentre/1',
  'NominalAnalysisNominalDepartment/1',
  'NominalAnalysisTransactionAnalysisCode/1',
  'NominalAnalysisNominalAnalysisNarrative/1',
  'NominalAnalysisTransactionValue/2',
  'NominalAnalysisNominalAccountNumber/2',
  'NominalAnalysisNominalCostCentre/2',
  'NominalAnalysisNominalDepartment/2',
  'NominalAnalysisNominalAnalysisNarrative/2',
  'TaxAnalysisTaxRate/1',
  'TaxAnalysisGoodsValueBeforeDiscount/1',
  'TaxAnalysisTaxOnGoodsValue/1',
  'VAT Code/1',
  'TaxAnalysisTaxRate/2',
  'TaxAnalysisGoodsValueBeforeDiscount/2',
  'TaxAnalysisTaxOnGoodsValue/2',
  'VAT Code/2',
  'Approver-1',
  'Approver-2',
  'Approver Comments',
  'Authorised by',
  'Authorised Date',
  'Approval',
  'Approval Sent',
  'Date approval sent',
  'Run Approval Flow',
  'Check totals',
  'Created',
  'Created By',
  'Modified',
  'Modified By',
];

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    const dt = new Date(d);
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const year = dt.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

function formatAmount(n: unknown): string {
  if (n == null || n === '') return '';
  const num = Number(n);
  if (isNaN(num)) return '';
  return num.toFixed(2);
}

function csvCell(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validatePo(
  po: Record<string, unknown>,
  nominalLines: Record<string, unknown>[],
  vatLines: Record<string, unknown>[],
): ValidationResult {
  const errors: string[] = [];
  const TOLERANCE = 0.01;

  const net = Number(po.net_amount ?? 0);
  const vat = Number(po.vat_amount ?? 0);
  const gross = Number(po.gross_amount ?? 0);

  // Net + VAT = Gross
  if (Math.abs(net + vat - gross) > TOLERANCE) {
    errors.push(`Net (${net}) + VAT (${vat}) ≠ Gross (${gross})`);
  }

  // Sum of nominal lines = Net
  const nominalSum = nominalLines.reduce(
    (s, l) => s + Number(l.transaction_value ?? 0),
    0,
  );
  if (nominalLines.length > 0 && Math.abs(nominalSum - net) > TOLERANCE) {
    errors.push(`Nominal lines total (${nominalSum}) ≠ Net (${net})`);
  }

  // Sum of VAT analysis = VAT
  const vatSum = vatLines.reduce(
    (s, l) => s + Number(l.tax_on_goods_value ?? 0),
    0,
  );
  if (vatLines.length > 0 && Math.abs(vatSum - vat) > TOLERANCE) {
    errors.push(`VAT analysis total (${vatSum}) ≠ VAT (${vat})`);
  }

  // Required fields
  if (!po.account_number) errors.push('AccountNumber is required');
  if (!po.supplier_name)  errors.push('Supplier Name is required');
  if (!po.transaction_date) errors.push('TransactionDate is required');

  return { valid: errors.length === 0, errors };
}

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

  const { purchase_order_ids }: { purchase_order_ids: string[] } = await req.json();
  if (!purchase_order_ids?.length) {
    return new Response(JSON.stringify({ error: 'purchase_order_ids array required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch all POs with their related data
    const { data: pos, error: posError } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        invoice_file:invoice_file_id (email_from, email_date),
        approver:assigned_approver_id (email, display_name),
        second_approver:second_approver_id (email, display_name),
        approved_by:approved_by_id (email, display_name, user_number),
        created_by:created_by_id (email, display_name),
        updated_by:updated_by_id (email, display_name)
      `)
      .in('id', purchase_order_ids)
      .in('status', ['approved', 'approved_ready_export']);

    if (posError) throw new Error(posError.message);
    if (!pos?.length) throw new Error('No approved POs found with the given IDs');

    // Validate each PO
    const validationSummary: Record<string, ValidationResult> = {};
    const csvRows: string[][] = [];

    for (const po of pos) {
      const { data: nominalLines } = await supabaseAdmin
        .from('nominal_lines')
        .select('*')
        .eq('purchase_order_id', po.id)
        .order('line_number');

      const { data: vatLines } = await supabaseAdmin
        .from('vat_lines')
        .select('*')
        .eq('purchase_order_id', po.id)
        .order('line_number');

      const nl = nominalLines ?? [];
      const vl = vatLines ?? [];

      const validation = validatePo(po, nl, vl);
      validationSummary[po.id] = validation;

      if (!validation.valid) continue; // Skip invalid POs

      const n1 = nl.find((l) => l.line_number === 1);
      const n2 = nl.find((l) => l.line_number === 2);
      const v1 = vl.find((l) => l.line_number === 1);
      const v2 = vl.find((l) => l.line_number === 2);

      const checkTotals = (() => {
        const net = Number(po.net_amount ?? 0);
        const vat = Number(po.vat_amount ?? 0);
        const gross = Number(po.gross_amount ?? 0);
        return Math.abs(net + vat - gross) <= 0.01 ? 'OK' : 'FAIL';
      })();

      const row: string[] = [
        po.account_number ?? '',
        po.supplier_name ?? '',
        po.supplier_ref ?? '',
        po.supplier_ref_code ?? '',
        po.transaction_reference ?? '',
        po.second_reference ?? '',
        po.unique_reference_number ?? '',
        po.invoice_file?.email_from ?? '',
        formatDate(po.invoice_file?.email_date),
        formatDate(po.transaction_date),
        formatDate(po.posting_date),
        formatDate(po.due_date),
        po.description ?? '',
        formatAmount(po.net_amount),
        formatAmount(po.net_amount),   // GoodsValueInBaseCurrency = GoodsValueInAccountCurrency for GBP
        formatAmount(po.vat_amount),
        formatAmount(po.gross_amount),
        formatAmount(po.document_to_base_currency_rate ?? 1),
        formatAmount(po.document_to_account_currency_rate ?? 1),
        String(po.source ?? 2),
        String(po.sys_trader_tran_type ?? 4),
        po.approved_by?.user_number ?? '',
        po.query_code ?? '',
        po.sys_trader_generation_reason_type ?? '',
        // Nominal line 1
        formatAmount(n1?.transaction_value),
        n1?.nominal_account_number ?? '',
        n1?.nominal_cost_centre ?? '',
        n1?.nominal_department ?? '',
        n1?.transaction_analysis_code ?? '',
        n1?.nominal_analysis_narrative ?? '',
        // Nominal line 2
        formatAmount(n2?.transaction_value),
        n2?.nominal_account_number ?? '',
        n2?.nominal_cost_centre ?? '',
        n2?.nominal_department ?? '',
        n2?.nominal_analysis_narrative ?? '',
        // VAT line 1
        formatAmount(v1?.tax_rate),
        formatAmount(v1?.goods_value_before_discount),
        formatAmount(v1?.tax_on_goods_value),
        v1?.vat_code ?? '',
        // VAT line 2
        formatAmount(v2?.tax_rate),
        formatAmount(v2?.goods_value_before_discount),
        formatAmount(v2?.tax_on_goods_value),
        v2?.vat_code ?? '',
        // Approval fields
        po.approver?.display_name ?? '',
        po.second_approver?.display_name ?? '',
        po.approver_comments ?? '',
        po.approved_by?.display_name ?? '',
        formatDate(po.approved_at),
        po.approved_at ? 'TRUE' : 'FALSE',
        po.approval_sent_at ? 'TRUE' : 'FALSE',
        formatDate(po.approval_sent_at),
        po.approval_sent_at ? 'TRUE' : 'FALSE',  // Run Approval Flow
        checkTotals,
        formatDate(po.created_at),
        po.created_by?.display_name ?? '',
        formatDate(po.updated_at),
        po.updated_by?.display_name ?? '',
      ];

      csvRows.push(row);
    }

    // Check for validation failures
    const failedIds = Object.entries(validationSummary)
      .filter(([, v]) => !v.valid)
      .map(([id, v]) => ({ id, errors: v.errors }));

    if (failedIds.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', failures: failedIds }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (csvRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid records to export' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build CSV content
    const csvContent = [
      SAGE_HEADERS.join(','),
      ...csvRows.map((row) => row.map(csvCell).join(',')),
    ].join('\r\n');

    const csvBytes = new TextEncoder().encode(csvContent);

    // Upload to Supabase Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `exports/${timestamp}_sage200_${csvRows.length}records.csv`;

    const { error: storageError } = await supabaseAdmin.storage
      .from('csv-exports')
      .upload(storagePath, csvBytes, {
        contentType: 'text/csv',
        upsert: false,
      });

    if (storageError) throw new Error(`CSV storage upload failed: ${storageError.message}`);

    // Insert csv_exports record
    const { data: exportRecord, error: exportError } = await supabaseAdmin
      .from('csv_exports')
      .insert({
        storage_path: storagePath,
        bucket_name: 'csv-exports',
        record_count: csvRows.length,
        validation_summary: validationSummary,
        generated_by_id: user.id,
      })
      .select()
      .single();

    if (exportError) throw new Error(exportError.message);

    // Update each PO to exported status
    const validIds = pos
      .filter((po) => validationSummary[po.id]?.valid)
      .map((po) => po.id);

    await supabaseAdmin
      .from('purchase_orders')
      .update({
        status: 'exported',
        exported_at: new Date().toISOString(),
        exported_by_id: user.id,
        csv_export_id: exportRecord.id,
      })
      .in('id', validIds);

    // Audit log for each exported PO
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, display_name')
      .eq('id', user.id)
      .single();

    for (const id of validIds) {
      await supabaseAdmin.from('audit_log').insert({
        purchase_order_id: id,
        action: 'exported',
        actor_id: user.id,
        actor_email: profile?.email ?? user.email,
        actor_display: profile?.display_name,
        new_values: {
          status: 'exported',
          csv_export_id: exportRecord.id,
          storage_path: storagePath,
        },
      });
    }

    // Generate signed download URL (valid 1 hour)
    const { data: signedUrl } = await supabaseAdmin.storage
      .from('csv-exports')
      .createSignedUrl(storagePath, 3600);

    return new Response(
      JSON.stringify({
        success: true,
        export_id: exportRecord.id,
        record_count: csvRows.length,
        download_url: signedUrl?.signedUrl,
        storage_path: storagePath,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
