import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useInvoice, useNominalLines, useVatLines, useOcrExtraction } from '../hooks/useInvoices';
import { useSubmitApprovalDecision, useApprovers } from '../hooks/useApprovals';
import OcrComparisonPanel from '../components/invoice/OcrComparisonPanel';
import StatusBadge from '../components/shared/StatusBadge';
import { getInvoiceSignedUrl } from '../lib/auth';
import type { PurchaseOrder, NominalLine, VatLine } from '../lib/supabase';

export default function ApproverView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: po, isLoading } = useInvoice(id!);
  const { data: nominalLines = [] } = useNominalLines(id!);
  const { data: vatLines = [] } = useVatLines(id!);
  const { data: ocr } = useOcrExtraction(id!);
  const { data: approvers = [] } = useApprovers();
  const submitDecision = useSubmitApprovalDecision();

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | 'forward' | null>(null);
  const [comment, setComment] = useState('');
  const [forwardTo, setForwardTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (po) {
      const fileData = (po as Record<string, unknown>).invoice_file as { storage_path?: string } | null;
      if (fileData?.storage_path) {
        getInvoiceSignedUrl(fileData.storage_path).then(setPdfUrl);
      }
    }
  }, [po]);

  if (isLoading) return <div style={styles.loading}>Loading invoice…</div>;
  if (!po) return <div style={styles.error}>Invoice not found.</div>;

  const poData = po as PurchaseOrder & { invoice_file?: unknown; approver?: unknown };

  const handleSubmit = async () => {
    if (!action) return;
    if (action === 'reject' && !comment.trim()) {
      setError('A comment is required when rejecting.');
      return;
    }
    if (action === 'forward' && !forwardTo) {
      setError('Please select an approver to forward to.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitDecision.mutateAsync({
        purchase_order_id: id!,
        action,
        comment: comment.trim() || undefined,
        forward_to_approver_id: action === 'forward' ? forwardTo : undefined,
      });
      setSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={styles.successPage}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>
            {action === 'approve' ? '✅' : action === 'reject' ? '❌' : '➡'}
          </div>
          <h2 style={styles.successTitle}>
            {action === 'approve' ? 'Invoice Approved' : action === 'reject' ? 'Invoice Rejected' : 'Invoice Forwarded'}
          </h2>
          <p style={styles.successText}>
            {action === 'approve'
              ? 'Thank you. Finance has been notified of your approval.'
              : action === 'reject'
              ? 'Thank you. Finance has been notified with your reason.'
              : 'The invoice has been forwarded to the selected approver.'}
          </p>
        </div>
      </div>
    );
  }

  const formatAmount = (v: number | null) =>
    v != null ? `£${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Invoice Approval</h1>
          <p style={styles.subtitle}>Review the invoice details below. You are confirming spend approval only.</p>
        </div>
        <StatusBadge status={poData.status} />
      </div>

      <div style={styles.readOnlyNotice}>
        All invoice data below is read-only. Finance has validated all details.
      </div>

      <div style={styles.layout}>
        {/* Left: PDF */}
        <div style={styles.pdfPanel}>
          {pdfUrl ? (
            <iframe src={pdfUrl} style={styles.pdfFrame} title="Invoice" />
          ) : (
            <div style={styles.noPdf}>No document available</div>
          )}
        </div>

        {/* Right: Summary + Actions */}
        <div style={styles.rightPanel}>
          {/* Invoice Summary */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Invoice Summary</h3>
            <table style={styles.summaryTable}>
              <tbody>
                <tr>
                  <td style={styles.summaryKey}>Supplier</td>
                  <td style={styles.summaryVal}>{poData.supplier_name ?? '—'}</td>
                </tr>
                <tr>
                  <td style={styles.summaryKey}>Account Number</td>
                  <td style={styles.summaryVal}>{poData.account_number ?? '—'}</td>
                </tr>
                <tr>
                  <td style={styles.summaryKey}>Invoice Reference</td>
                  <td style={styles.summaryVal}>{poData.transaction_reference ?? '—'}</td>
                </tr>
                <tr>
                  <td style={styles.summaryKey}>Invoice Date</td>
                  <td style={styles.summaryVal}>
                    {poData.transaction_date ? format(new Date(poData.transaction_date), 'dd/MM/yyyy') : '—'}
                  </td>
                </tr>
                <tr>
                  <td style={styles.summaryKey}>Description</td>
                  <td style={styles.summaryVal}>{poData.description ?? '—'}</td>
                </tr>
                <tr style={{ background: '#f8f9fa' }}>
                  <td style={styles.summaryKey}>Net Amount</td>
                  <td style={styles.summaryVal}>{formatAmount(poData.net_amount)}</td>
                </tr>
                <tr style={{ background: '#f8f9fa' }}>
                  <td style={styles.summaryKey}>VAT Amount</td>
                  <td style={styles.summaryVal}>{formatAmount(poData.vat_amount)}</td>
                </tr>
                <tr style={{ background: '#e8f4fd' }}>
                  <td style={{ ...styles.summaryKey, fontWeight: 700 }}>GROSS AMOUNT</td>
                  <td style={{ ...styles.summaryVal, fontWeight: 700, fontSize: 18, color: '#1e3a5f' }}>
                    {formatAmount(poData.gross_amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Finance Notes */}
          {poData.finance_notes && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Finance Notes</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.6 }}>
                {poData.finance_notes}
              </p>
            </section>
          )}

          {/* Nominal lines (read-only) */}
          {nominalLines.length > 0 && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Nominal Analysis</h3>
              {(nominalLines as NominalLine[]).map((line) => (
                <div key={line.id} style={styles.nominalRow}>
                  <span style={styles.nominalLabel}>Line {line.line_number}:</span>
                  <span>{line.nominal_account_number ?? '—'}</span>
                  <span style={styles.divider}>|</span>
                  <span>{line.nominal_cost_centre ?? '—'}</span>
                  <span style={styles.divider}>|</span>
                  <span>{line.nominal_department ?? '—'}</span>
                  <span style={styles.divider}>|</span>
                  <span style={{ fontWeight: 600 }}>
                    {line.transaction_value != null ? formatAmount(line.transaction_value) : '—'}
                  </span>
                </div>
              ))}
            </section>
          )}

          {/* OCR Comparison */}
          <OcrComparisonPanel ocr={ocr ?? null} po={poData} />

          {/* Approval Actions — only shown if pending */}
          {poData.status === 'pending_approval' && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Your Decision</h3>
              <p style={styles.decisionNote}>
                By approving, you are confirming this spend is authorised. You are not verifying invoice accuracy.
              </p>

              <div style={styles.actionButtons}>
                <button
                  style={{ ...styles.actionBtn, ...styles.approveBtn, ...(action === 'approve' ? styles.selected : {}) }}
                  onClick={() => setAction('approve')}
                >
                  ✅ Approve
                </button>
                <button
                  style={{ ...styles.actionBtn, ...styles.rejectBtn, ...(action === 'reject' ? styles.selected : {}) }}
                  onClick={() => setAction('reject')}
                >
                  ❌ Reject
                </button>
                <button
                  style={{ ...styles.actionBtn, ...styles.forwardBtn, ...(action === 'forward' ? styles.selected : {}) }}
                  onClick={() => setAction('forward')}
                >
                  ➡ Forward
                </button>
              </div>

              {(action === 'reject' || action === 'forward') && (
                <div style={{ marginTop: 12 }}>
                  <label style={styles.label}>
                    {action === 'reject' ? 'Reason for rejection (required)' : 'Reason for forwarding'}
                  </label>
                  <textarea
                    style={styles.textarea}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={action === 'reject' ? 'Provide a reason…' : 'Optional reason…'}
                  />
                </div>
              )}

              {action === 'forward' && (
                <div style={{ marginTop: 10 }}>
                  <label style={styles.label}>Forward to approver</label>
                  <select
                    style={styles.select}
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                  >
                    <option value="">Select approver…</option>
                    {approvers.map((a) => (
                      <option key={a.id} value={a.id}>{a.display_name} ({a.email})</option>
                    ))}
                  </select>
                </div>
              )}

              {error && <div style={styles.errorBanner}>{error}</div>}

              {action && (
                <button
                  style={styles.submitBtn}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting…' : `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`}
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100%' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 12, flexWrap: 'wrap', gap: 8,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#1e3a5f' },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: '#666' },
  readOnlyNotice: {
    background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6,
    padding: '8px 14px', fontSize: 13, color: '#856404', marginBottom: 16,
  },
  layout: { display: 'flex', gap: 16, minHeight: 600 },
  pdfPanel: { width: '45%', minWidth: 300, background: '#f8f9fa', borderRadius: 8, overflow: 'hidden' },
  pdfFrame: { width: '100%', height: '100%', minHeight: 600, border: 'none' },
  noPdf: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#888' },
  rightPanel: { flex: 1, overflowY: 'auto' },
  section: { background: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #e9ecef' },
  sectionTitle: { margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1e3a5f' },
  summaryTable: { width: '100%', borderCollapse: 'collapse' },
  summaryKey: { padding: '8px 12px', fontSize: 13, fontWeight: 500, color: '#666', width: '40%', borderBottom: '1px solid #f0f0f0' },
  summaryVal: { padding: '8px 12px', fontSize: 13, color: '#212529', borderBottom: '1px solid #f0f0f0' },
  nominalRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f5f5f5' },
  nominalLabel: { fontWeight: 700, color: '#495057', minWidth: 50 },
  divider: { color: '#dee2e6' },
  decisionNote: { margin: '0 0 16px', fontSize: 13, color: '#666', background: '#f8f9fa', padding: 10, borderRadius: 4 },
  actionButtons: { display: 'flex', gap: 10 },
  actionBtn: {
    flex: 1, padding: '12px 8px', border: '2px solid transparent',
    borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  approveBtn: { background: '#d1e7dd', color: '#0a3622', borderColor: '#a3cfbb' },
  rejectBtn: { background: '#f8d7da', color: '#842029', borderColor: '#f1aeb5' },
  forwardBtn: { background: '#fff3cd', color: '#664d03', borderColor: '#ffe69c' },
  selected: { outline: '3px solid #1e3a5f', outlineOffset: 2 },
  label: { fontSize: 12, color: '#666', fontWeight: 500, marginBottom: 4, display: 'block' },
  textarea: { width: '100%', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 13, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
  select: { width: '100%', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 13 },
  errorBanner: { background: '#f8d7da', color: '#842029', padding: '8px 12px', borderRadius: 4, fontSize: 13, marginTop: 10 },
  submitBtn: {
    marginTop: 14, width: '100%', padding: '12px', background: '#1e3a5f',
    color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15, fontWeight: 700,
  },
  successPage: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  successCard: { background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
  successIcon: { fontSize: 48, marginBottom: 16 },
  successTitle: { margin: '0 0 12px', fontSize: 22, color: '#1e3a5f' },
  successText: { margin: 0, fontSize: 14, color: '#555', lineHeight: 1.6 },
  loading: { padding: 40, textAlign: 'center', color: '#888' },
  error: { padding: 16, background: '#f8d7da', color: '#842029', borderRadius: 8 },
};
