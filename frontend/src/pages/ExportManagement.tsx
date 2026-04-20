import { useState } from 'react';
import { format } from 'date-fns';
import { useInvoices } from '../hooks/useInvoices';
import { useCsvExports, useGenerateCsv } from '../hooks/useExport';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/shared/StatusBadge';

export default function ExportManagement() {
  const { data: approvedPos = [] } = useInvoices(['approved', 'approved_ready_export'] as never);
  const { data: exports = [] } = useCsvExports();
  const generateCsv = useGenerateCsv();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ url: string; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(approvedPos.map((p) => p.id)));
  const clearAll = () => setSelected(new Set());

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateCsv.mutateAsync(Array.from(selected));
      setResult({ url: res.download_url, count: res.record_count });
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const getExportDownloadUrl = async (storagePath: string) => {
    setError(null);
    try {
      const { data, error: urlError } = await supabase.storage
        .from('csv-exports')
        .createSignedUrl(storagePath, 3600);
      if (urlError) throw urlError;
      if (!data?.signedUrl) throw new Error('No signed URL returned');
      window.open(data.signedUrl, '_blank');
    } catch (e) {
      setError(`Could not generate download link: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <h1 style={styles.pageTitle}>CSV Export — Sage 200</h1>

      {/* Approved POs ready to export */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Approved Invoices</h2>
          <div style={styles.sectionActions}>
            <button style={styles.linkBtn} onClick={selectAll}>Select all ({approvedPos.length})</button>
            <button style={styles.linkBtn} onClick={clearAll}>Clear</button>
          </div>
        </div>

        {approvedPos.length === 0 ? (
          <div style={styles.empty}>No approved invoices awaiting export.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}><input type="checkbox" onChange={(e) => e.target.checked ? selectAll() : clearAll()} /></th>
                  <th style={styles.th}>Supplier</th>
                  <th style={styles.th}>Invoice Ref</th>
                  <th style={styles.th}>Invoice Date</th>
                  <th style={styles.th}>Net</th>
                  <th style={styles.th}>VAT</th>
                  <th style={styles.th}>Gross</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Approved</th>
                </tr>
              </thead>
              <tbody>
                {approvedPos.map((po) => (
                  <tr key={po.id} style={{ background: selected.has(po.id) ? '#e8f4fd' : undefined }}>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selected.has(po.id)}
                        onChange={() => toggleSelect(po.id)}
                      />
                    </td>
                    <td style={styles.td}>{po.supplier_name ?? '—'}</td>
                    <td style={styles.td}>{po.transaction_reference ?? '—'}</td>
                    <td style={styles.td}>
                      {po.transaction_date ? format(new Date(po.transaction_date), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td style={styles.td}>{po.net_amount != null ? `£${Number(po.net_amount).toFixed(2)}` : '—'}</td>
                    <td style={styles.td}>{po.vat_amount != null ? `£${Number(po.vat_amount).toFixed(2)}` : '—'}</td>
                    <td style={{ ...styles.td, fontWeight: 700 }}>
                      {po.gross_amount != null ? `£${Number(po.gross_amount).toFixed(2)}` : '—'}
                    </td>
                    <td style={styles.td}><StatusBadge status={po.status} /></td>
                    <td style={styles.td}>
                      {po.approved_at ? format(new Date(po.approved_at), 'dd/MM/yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected.size > 0 && (
          <div style={styles.exportBar}>
            <span style={styles.exportCount}>{selected.size} invoice{selected.size !== 1 ? 's' : ''} selected</span>
            <button style={styles.exportBtn} onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating CSV…' : `Generate Sage 200 CSV (${selected.size})`}
            </button>
          </div>
        )}

        {error && (
          <div style={styles.errorBanner}>
            <strong>Export failed:</strong> {error}
          </div>
        )}

        {result && (
          <div style={styles.successBanner}>
            CSV generated with {result.count} records.{' '}
            <button
              type="button"
              onClick={() => window.open(result.url, '_blank')}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: '#0a3622', fontWeight: 700, cursor: 'pointer',
                textDecoration: 'underline', font: 'inherit',
              }}
            >
              Download CSV
            </button>
          </div>
        )}
      </section>

      {/* Export history */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Export History</h2>

        {exports.length === 0 ? (
          <div style={styles.empty}>No exports yet.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Generated</th>
                <th style={styles.th}>Records</th>
                <th style={styles.th}>Generated By</th>
                <th style={styles.th}>Download</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((exp) => {
                const generatedBy = (exp as Record<string, unknown>).generated_by as { display_name?: string } | null;
                return (
                  <tr key={exp.id}>
                    <td style={styles.td}>
                      {format(new Date(exp.generated_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td style={styles.td}>{exp.record_count}</td>
                    <td style={styles.td}>{generatedBy?.display_name ?? '—'}</td>
                    <td style={styles.td}>
                      <button
                        style={styles.downloadBtn}
                        onClick={() => getExportDownloadUrl(exp.storage_path)}
                      >
                        Download CSV
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageTitle: { margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: '#1e3a5f' },
  section: { background: '#fff', borderRadius: 8, padding: 20, marginBottom: 20, border: '1px solid #e9ecef' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#333' },
  sectionActions: { display: 'flex', gap: 12 },
  linkBtn: { background: 'none', border: 'none', color: '#0d6efd', cursor: 'pointer', fontSize: 13 },
  tableWrap: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '10px 12px', background: '#f8f9fa', textAlign: 'left',
    fontSize: 12, fontWeight: 700, color: '#6c757d', borderBottom: '1px solid #e9ecef',
  },
  td: { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle' },
  exportBar: {
    marginTop: 16, padding: '12px 16px', background: '#e8f4fd',
    borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  exportCount: { fontSize: 14, fontWeight: 600, color: '#084298' },
  exportBtn: {
    padding: '10px 20px', background: '#1e3a5f', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 700,
  },
  downloadBtn: {
    padding: '5px 12px', background: '#fff', border: '1px solid #dee2e6',
    borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#333',
  },
  errorBanner: {
    marginTop: 12, background: '#f8d7da', color: '#842029',
    border: '1px solid #f5c2c7', borderRadius: 6, padding: '10px 14px', fontSize: 13,
  },
  successBanner: {
    marginTop: 12, background: '#d1e7dd', color: '#0a3622',
    border: '1px solid #a3cfbb', borderRadius: 6, padding: '10px 14px', fontSize: 13,
  },
  empty: { padding: 24, textAlign: 'center', color: '#888', fontSize: 14 },
};
