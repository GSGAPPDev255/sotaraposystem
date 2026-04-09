import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useInvoices } from '../hooks/useInvoices';
import StatusBadge from '../components/shared/StatusBadge';
import type { InvoiceStatus } from '../lib/supabase';

const STATUS_FILTERS: { label: string; value: InvoiceStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending Review', value: 'pending_finance_review' },
  { label: 'Pending Approval', value: 'pending_approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Ready to Export', value: 'approved_ready_export' },
  { label: 'Exported', value: 'exported' },
];

export default function FinanceDashboard() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const navigate = useNavigate();

  const { data: invoices = [], isLoading, error } = useInvoices(
    statusFilter === 'all' ? undefined : statusFilter,
  );

  if (error) {
    return <div style={styles.error}>Failed to load invoices: {(error as Error).message}</div>;
  }

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Invoice Dashboard</h1>
        <span style={styles.count}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Status filter chips */}
      <div style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            style={{
              ...styles.chip,
              ...(statusFilter === f.value ? styles.chipActive : {}),
            }}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={styles.loading}>Loading…</div>
      ) : invoices.length === 0 ? (
        <div style={styles.empty}>No invoices found for this filter.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Supplier</th>
                <th style={styles.th}>Invoice Ref</th>
                <th style={styles.th}>Invoice Date</th>
                <th style={styles.th}>Gross Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Assigned Approver</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const approver = inv.approver as { display_name?: string } | null;
                return (
                  <tr
                    key={inv.id}
                    style={styles.row}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <td style={styles.td}>
                      <div style={styles.supplierName}>{inv.supplier_name ?? '—'}</div>
                      <div style={styles.accountNum}>{inv.account_number ?? ''}</div>
                    </td>
                    <td style={styles.td}>{inv.transaction_reference ?? '—'}</td>
                    <td style={styles.td}>
                      {inv.transaction_date
                        ? format(new Date(inv.transaction_date), 'dd/MM/yyyy')
                        : '—'}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>
                      {inv.gross_amount != null
                        ? `£${Number(inv.gross_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td style={styles.td}>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td style={styles.td}>
                      {approver?.display_name ?? <span style={{ color: '#bbb' }}>Unassigned</span>}
                    </td>
                    <td style={styles.td}>
                      {format(new Date(inv.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                      <button
                        style={styles.actionBtn}
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                      >
                        Review
                      </button>
                      <button
                        style={styles.actionBtn}
                        onClick={() => navigate(`/audit/${inv.id}`)}
                      >
                        Audit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  pageTitle: { margin: 0, fontSize: 22, fontWeight: 700, color: '#1e3a5f' },
  count: { background: '#e9ecef', color: '#495057', padding: '2px 10px', borderRadius: 12, fontSize: 13 },
  filterRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  chip: {
    padding: '5px 14px', borderRadius: 20, border: '1px solid #dee2e6',
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#495057',
  },
  chipActive: { background: '#1e3a5f', color: '#fff', border: '1px solid #1e3a5f', fontWeight: 600 },
  tableWrap: { background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 16px', background: '#f8f9fa', textAlign: 'left',
    fontSize: 12, fontWeight: 700, color: '#6c757d', textTransform: 'uppercase',
    letterSpacing: 0.5, borderBottom: '1px solid #e9ecef',
  },
  row: { cursor: 'pointer', transition: 'background 0.12s' },
  td: { padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' },
  supplierName: { fontWeight: 600, color: '#212529' },
  accountNum: { fontSize: 11, color: '#888', marginTop: 2 },
  actionBtn: {
    padding: '4px 10px', fontSize: 12, border: '1px solid #dee2e6',
    borderRadius: 4, cursor: 'pointer', background: '#fff', marginRight: 4,
  },
  loading: { textAlign: 'center', padding: 40, color: '#888' },
  empty: { textAlign: 'center', padding: 40, color: '#888', background: '#fff', borderRadius: 8 },
  error: { background: '#f8d7da', color: '#842029', padding: 16, borderRadius: 8 },
};
