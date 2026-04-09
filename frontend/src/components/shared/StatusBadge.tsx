import type { InvoiceStatus } from '../../lib/supabase';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  pending_finance_review: { label: 'Pending Review',   bg: '#fff3cd', color: '#856404' },
  pending_approval:       { label: 'Pending Approval', bg: '#cfe2ff', color: '#084298' },
  approved:               { label: 'Approved',         bg: '#d1e7dd', color: '#0a3622' },
  rejected:               { label: 'Rejected',         bg: '#f8d7da', color: '#842029' },
  approved_ready_export:  { label: 'Ready to Export',  bg: '#d0f0fd', color: '#0c4a6e' },
  exported:               { label: 'Exported',         bg: '#e2e3e5', color: '#41464b' },
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#e9ecef', color: '#495057' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}
