import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useInvoice, useOcrExtraction } from '../hooks/useInvoices';
import { useAuditLog } from '../hooks/useApprovals';
import AuditTimeline from '../components/shared/AuditTimeline';
import StatusBadge from '../components/shared/StatusBadge';
import OcrComparisonPanel from '../components/invoice/OcrComparisonPanel';
import type { PurchaseOrder } from '../lib/supabase';

export default function AuditTrailViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: po, isLoading } = useInvoice(id!);
  const { data: auditLog = [] } = useAuditLog(id!);
  const { data: ocr } = useOcrExtraction(id!);

  if (isLoading) return <div style={styles.loading}>Loading audit trail…</div>;
  if (!po) return <div style={styles.error}>Invoice not found.</div>;

  const poData = po as PurchaseOrder;

  return (
    <div>
      <div style={styles.header}>
        <button style={styles.back} onClick={() => navigate(`/invoices/${id}`)}>← Back to Invoice</button>
        <h1 style={styles.title}>Audit Trail</h1>
        <StatusBadge status={poData.status} />
      </div>

      {/* Invoice summary */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryKey}>Supplier</span>
          <span style={styles.summaryVal}>{poData.supplier_name ?? '—'}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryKey}>Invoice Ref</span>
          <span style={styles.summaryVal}>{poData.transaction_reference ?? '—'}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryKey}>Invoice Date</span>
          <span style={styles.summaryVal}>
            {poData.transaction_date ? format(new Date(poData.transaction_date), 'dd/MM/yyyy') : '—'}
          </span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryKey}>Gross Amount</span>
          <span style={{ ...styles.summaryVal, fontWeight: 700, color: '#1e3a5f', fontSize: 16 }}>
            {poData.gross_amount != null
              ? `£${Number(poData.gross_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
              : '—'}
          </span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryKey}>Created</span>
          <span style={styles.summaryVal}>{format(new Date(poData.created_at), 'dd/MM/yyyy HH:mm')}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryKey}>Last Updated</span>
          <span style={styles.summaryVal}>{format(new Date(poData.updated_at), 'dd/MM/yyyy HH:mm')}</span>
        </div>
      </div>

      <div style={styles.layout}>
        <div style={styles.timelinePanel}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Event History ({auditLog.length} events)</h2>
            <AuditTimeline entries={auditLog} />
          </div>
        </div>

        <div style={styles.detailPanel}>
          {/* OCR Extraction */}
          {ocr && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>AI Extraction Record</h2>
              <OcrComparisonPanel ocr={ocr} po={poData} />
              <div style={styles.ocrMeta}>
                <span>Model: {ocr.gemini_model}</span>
                <span>Processing time: {ocr.processing_ms}ms</span>
                <span>Extracted: {format(new Date(ocr.created_at), 'dd/MM/yyyy HH:mm:ss')}</span>
              </div>
            </div>
          )}

          {/* Approval outcome */}
          {(poData.approved_at || poData.rejected_reason) && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Approval Outcome</h2>
              <table style={styles.detailTable}>
                <tbody>
                  {poData.approved_at && (
                    <tr>
                      <td style={styles.detailKey}>Approved at</td>
                      <td style={styles.detailVal}>{format(new Date(poData.approved_at), 'dd/MM/yyyy HH:mm')}</td>
                    </tr>
                  )}
                  {poData.approver_comments && (
                    <tr>
                      <td style={styles.detailKey}>Approver comments</td>
                      <td style={styles.detailVal}>{poData.approver_comments}</td>
                    </tr>
                  )}
                  {poData.rejected_reason && (
                    <tr>
                      <td style={styles.detailKey}>Rejection reason</td>
                      <td style={{ ...styles.detailVal, color: '#842029' }}>{poData.rejected_reason}</td>
                    </tr>
                  )}
                  {poData.forwarded_reason && (
                    <tr>
                      <td style={styles.detailKey}>Forwarded reason</td>
                      <td style={styles.detailVal}>{poData.forwarded_reason}</td>
                    </tr>
                  )}
                  {poData.exported_at && (
                    <tr>
                      <td style={styles.detailKey}>Exported at</td>
                      <td style={styles.detailVal}>{format(new Date(poData.exported_at), 'dd/MM/yyyy HH:mm')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  back: { background: 'none', border: 'none', cursor: 'pointer', color: '#1e3a5f', fontSize: 14 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#1e3a5f', flex: 1 },
  summary: {
    background: '#fff', borderRadius: 8, padding: '16px 20px', marginBottom: 16,
    display: 'flex', flexWrap: 'wrap', gap: '12px 32px', border: '1px solid #e9ecef',
  },
  summaryItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  summaryKey: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryVal: { fontSize: 14, fontWeight: 500, color: '#333' },
  layout: { display: 'flex', gap: 16 },
  timelinePanel: { flex: 1.2, minWidth: 0 },
  detailPanel: { flex: 1, minWidth: 0 },
  section: { background: '#fff', borderRadius: 8, padding: 20, marginBottom: 12, border: '1px solid #e9ecef' },
  sectionTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1e3a5f' },
  ocrMeta: {
    display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8,
    fontSize: 12, color: '#888', background: '#f8f9fa', padding: '8px 12px', borderRadius: 4,
  },
  detailTable: { width: '100%', borderCollapse: 'collapse' },
  detailKey: { padding: '8px 12px', fontSize: 13, color: '#666', fontWeight: 500, width: '40%', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' },
  detailVal: { padding: '8px 12px', fontSize: 13, color: '#333', borderBottom: '1px solid #f0f0f0' },
  loading: { padding: 40, textAlign: 'center', color: '#888' },
  error: { padding: 16, background: '#f8d7da', color: '#842029', borderRadius: 8 },
};
