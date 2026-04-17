import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  useInvoice, useNominalLines, useVatLines, useOcrExtraction,
  useUpdateInvoice, useUpsertNominalLine, useUpsertVatLine,
} from '../hooks/useInvoices';
import { useMarkReadyForApproval, useApprovers, useAuditLog } from '../hooks/useApprovals';
import OcrComparisonPanel from '../components/invoice/OcrComparisonPanel';
import NominalLineEditor from '../components/invoice/NominalLineEditor';
import VatLineEditor from '../components/invoice/VatLineEditor';
import AuditTimeline from '../components/shared/AuditTimeline';
import StatusBadge from '../components/shared/StatusBadge';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { getInvoiceSignedUrl } from '../lib/auth';
import type { PurchaseOrder, NominalLine, VatLine } from '../lib/supabase';

export default function InvoiceReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: po, isLoading } = useInvoice(id!);
  const { data: nominalLines = [] } = useNominalLines(id!);
  const { data: vatLines = [] } = useVatLines(id!);
  const { data: ocr } = useOcrExtraction(id!);
  const { data: approvers = [] } = useApprovers();
  const { data: auditLog = [] } = useAuditLog(id!);

  const updateInvoice = useUpdateInvoice();
  const upsertNominal = useUpsertNominalLine();
  const upsertVat = useUpsertVatLine();
  const markReady = useMarkReadyForApproval();

  const [form, setForm] = useState<Partial<PurchaseOrder>>({});
  const [nominal1, setNominal1] = useState<Partial<NominalLine>>({});
  const [nominal2, setNominal2] = useState<Partial<NominalLine>>({});
  const [vat1, setVat1] = useState<Partial<VatLine>>({});
  const [vat2, setVat2] = useState<Partial<VatLine>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (po) {
      // Strip all joined relationship objects — they are not PO columns and will
      // cause a PostgREST schema error if sent in an update payload.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { invoice_file, approver, second_approver, approved_by,
              created_by, updated_by, forwarded_to, ...poFields } = po as Record<string, unknown>;
      setForm(poFields as Partial<PurchaseOrder>);
    }
  }, [po]);

  useEffect(() => {
    if (nominalLines[0]) setNominal1(nominalLines[0]);
    if (nominalLines[1]) setNominal2(nominalLines[1]);
  }, [nominalLines]);

  useEffect(() => {
    if (vatLines[0]) setVat1(vatLines[0]);
    if (vatLines[1]) setVat2(vatLines[1]);
  }, [vatLines]);

  useEffect(() => {
    if (po?.invoice_file_id) {
      const fileData = (po as Record<string, unknown>).invoice_file as { storage_path?: string } | null;
      if (fileData?.storage_path) {
        getInvoiceSignedUrl(fileData.storage_path).then(setPdfUrl);
      }
    }
  }, [po]);

  if (isLoading) return <div style={styles.loading}>Loading invoice…</div>;
  if (!po) return <div style={styles.error}>Invoice not found.</div>;

  const poData = po as PurchaseOrder & { invoice_file?: unknown; approver?: unknown };
  const isEditable = ['pending_finance_review', 'rejected'].includes(poData.status);

  const f = (key: keyof PurchaseOrder, label: string, type: 'text' | 'number' | 'date' | 'textarea' = 'text') => (
    <div style={styles.field} key={key}>
      <label style={styles.label}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          style={{ ...styles.input, height: 60, resize: 'vertical' }}
          value={String(form[key] ?? '')}
          readOnly={!isEditable}
          disabled={!isEditable}
          maxLength={key === 'description' ? 75 : undefined}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value || null }))}
        />
      ) : (
        <input
          type={type}
          style={styles.input}
          value={String(form[key] ?? '')}
          readOnly={!isEditable}
          disabled={!isEditable}
          onChange={(e) => setForm((prev) => ({
            ...prev,
            [key]: type === 'number' ? parseFloat(e.target.value) || null : e.target.value || null,
          }))}
        />
      )}
      {key === 'description' && (
        <span style={styles.charCount}>{String(form.description ?? '').length}/75</span>
      )}
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser());
      await updateInvoice.mutateAsync({ id: id!, updates: { ...form, finance_user_id: user?.id } });

      if (nominal1.nominal_account_number || nominal1.transaction_value) {
        await upsertNominal.mutateAsync({ ...nominal1, purchase_order_id: id!, line_number: 1 });
      }
      if (nominal2.nominal_account_number || nominal2.transaction_value) {
        await upsertNominal.mutateAsync({ ...nominal2, purchase_order_id: id!, line_number: 2 });
      }
      if (vat1.vat_code || vat1.tax_rate) {
        await upsertVat.mutateAsync({ ...vat1, purchase_order_id: id!, line_number: 1 });
      }
      if (vat2.vat_code || vat2.tax_rate) {
        await upsertVat.mutateAsync({ ...vat2, purchase_order_id: id!, line_number: 2 });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReady = async () => {
    setShowConfirm(false);
    try {
      await markReady.mutateAsync(id!);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.back} onClick={() => navigate('/dashboard')}>← Back</button>
        <div style={styles.headerMid}>
          <h1 style={styles.title}>{poData.supplier_name ?? 'Unnamed Invoice'}</h1>
          <StatusBadge status={poData.status} />
        </div>
        {isEditable && (
          <div style={styles.headerActions}>
            <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              style={styles.approvalBtn}
              onClick={() => setShowConfirm(true)}
              disabled={!poData.assigned_approver_id}
            >
              Mark Ready for Approval
            </button>
          </div>
        )}
      </div>

      {saveError && <div style={styles.errorBanner}>{saveError}</div>}
      {saveSuccess && <div style={styles.successBanner}>Saved successfully.</div>}

      <div style={styles.layout}>
        {/* Left: PDF viewer */}
        <div style={styles.pdfPanel}>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              style={styles.pdfFrame}
              title="Invoice document"
            />
          ) : (
            <div style={styles.noPdf}>No document available</div>
          )}
        </div>

        {/* Right: Form */}
        <div style={styles.formPanel}>
          {/* OCR Comparison */}
          <OcrComparisonPanel ocr={ocr ?? null} po={poData} />

          {/* Supplier */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Supplier Details</h3>
            <div style={styles.grid2}>
              {f('account_number', 'Account Number')}
              {f('supplier_name', 'Supplier Name')}
              {f('supplier_ref', 'Supplier Ref')}
              {f('supplier_ref_code', 'Supplier Ref Code')}
            </div>
          </section>

          {/* Invoice */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Invoice Details</h3>
            <div style={styles.grid2}>
              {f('transaction_reference', 'Invoice Number')}
              {f('second_reference', 'Second Reference')}
              {f('transaction_date', 'Invoice Date', 'date')}
              {f('due_date', 'Due Date', 'date')}
              {f('posting_date', 'Posting Date', 'date')}
            </div>
            <div style={styles.grid1}>
              {f('description', 'Description (max 75 chars)', 'textarea')}
            </div>
          </section>

          {/* Amounts */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Financial Amounts</h3>
            <div style={styles.grid3}>
              {f('net_amount', 'Net Amount', 'number')}
              {f('vat_amount', 'VAT Amount', 'number')}
              {f('gross_amount', 'Gross Amount', 'number')}
            </div>
          </section>

          {/* Nominal Lines */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Nominal Ledger Analysis</h3>
            <NominalLineEditor lineNumber={1} value={nominal1} onChange={setNominal1} readOnly={!isEditable} />
            <NominalLineEditor lineNumber={2} value={nominal2} onChange={setNominal2} readOnly={!isEditable} />
          </section>

          {/* VAT Lines */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>VAT Analysis</h3>
            <VatLineEditor lineNumber={1} value={vat1} onChange={setVat1} readOnly={!isEditable} />
            <VatLineEditor lineNumber={2} value={vat2} onChange={setVat2} readOnly={!isEditable} />
          </section>

          {/* Approver Assignment */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Approval Assignment</h3>
            <div style={styles.grid2}>
              <div style={styles.field}>
                <label style={styles.label}>Primary Approver</label>
                <select
                  style={styles.input}
                  value={form.assigned_approver_id ?? ''}
                  disabled={!isEditable}
                  onChange={(e) => setForm((p) => ({ ...p, assigned_approver_id: e.target.value || null }))}
                >
                  <option value="">Select approver…</option>
                  {approvers.map((a) => (
                    <option key={a.id} value={a.id}>{a.display_name} ({a.email})</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Second Approver (optional)</label>
                <select
                  style={styles.input}
                  value={form.second_approver_id ?? ''}
                  disabled={!isEditable}
                  onChange={(e) => setForm((p) => ({ ...p, second_approver_id: e.target.value || null }))}
                >
                  <option value="">None</option>
                  {approvers.map((a) => (
                    <option key={a.id} value={a.id}>{a.display_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Finance Notes (shown to approver)</label>
              <textarea
                style={{ ...styles.input, height: 80, resize: 'vertical' }}
                value={form.finance_notes ?? ''}
                readOnly={!isEditable}
                disabled={!isEditable}
                onChange={(e) => setForm((p) => ({ ...p, finance_notes: e.target.value || null }))}
              />
            </div>
          </section>

          {/* Audit Trail */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Audit Trail</h3>
            <AuditTimeline entries={auditLog} />
          </section>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Mark Ready for Approval"
          message="This will send an approval email to the assigned approver. Finance data will become read-only. Proceed?"
          confirmLabel="Send for Approval"
          onConfirm={handleMarkReady}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', gap: 16, padding: '0 0 16px',
    borderBottom: '1px solid #e9ecef', flexShrink: 0, flexWrap: 'wrap',
  },
  back: { background: 'none', border: 'none', cursor: 'pointer', color: '#1e3a5f', fontSize: 14 },
  headerMid: { flex: 1, display: 'flex', alignItems: 'center', gap: 12 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#1e3a5f' },
  headerActions: { display: 'flex', gap: 10 },
  saveBtn: {
    padding: '8px 16px', background: '#fff', border: '1px solid #1e3a5f',
    color: '#1e3a5f', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  approvalBtn: {
    padding: '8px 16px', background: '#1e3a5f', border: 'none',
    color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  layout: { display: 'flex', gap: 0, flex: 1, overflow: 'hidden', marginTop: 16 },
  pdfPanel: { width: '45%', minWidth: 320, background: '#f8f9fa', borderRadius: 8, overflow: 'hidden', marginRight: 16 },
  pdfFrame: { width: '100%', height: '100%', border: 'none' },
  noPdf: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888', fontSize: 14 },
  formPanel: { flex: 1, overflowY: 'auto' },
  section: { background: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #e9ecef' },
  sectionTitle: { margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e3a5f' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px' },
  grid1: { marginTop: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, color: '#666', fontWeight: 500 },
  input: { padding: '7px 10px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  charCount: { fontSize: 11, color: '#888', textAlign: 'right' },
  errorBanner: { background: '#f8d7da', color: '#842029', padding: '10px 14px', borderRadius: 6, marginBottom: 12, fontSize: 13 },
  successBanner: { background: '#d1e7dd', color: '#0a3622', padding: '10px 14px', borderRadius: 6, marginBottom: 12, fontSize: 13 },
  loading: { padding: 40, textAlign: 'center', color: '#888' },
  error: { padding: 16, background: '#f8d7da', color: '#842029', borderRadius: 8 },
};
