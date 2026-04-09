import type { OcrExtraction, PurchaseOrder } from '../../lib/supabase';

interface OcrComparisonPanelProps {
  ocr: OcrExtraction | null;
  po: PurchaseOrder;
}

const FIELD_MAP: { label: string; ocrKey: string; poKey: keyof PurchaseOrder }[] = [
  { label: 'Supplier Name',     ocrKey: 'supplier_name',   poKey: 'supplier_name' },
  { label: 'Invoice Number',    ocrKey: 'invoice_number',  poKey: 'transaction_reference' },
  { label: 'Invoice Date',      ocrKey: 'invoice_date',    poKey: 'transaction_date' },
  { label: 'Description',       ocrKey: 'description',     poKey: 'description' },
  { label: 'Net Amount',        ocrKey: 'net_amount',      poKey: 'net_amount' },
  { label: 'VAT Amount',        ocrKey: 'vat_amount',      poKey: 'vat_amount' },
  { label: 'Gross Amount',      ocrKey: 'gross_amount',    poKey: 'gross_amount' },
  { label: 'Account Number',    ocrKey: 'account_number',  poKey: 'account_number' },
  { label: 'Supplier Ref',      ocrKey: 'supplier_ref',    poKey: 'supplier_ref' },
  { label: 'Due Date',          ocrKey: 'due_date',        poKey: 'due_date' },
];

export default function OcrComparisonPanel({ ocr, po }: OcrComparisonPanelProps) {
  if (!ocr) {
    return (
      <div style={styles.card}>
        <h3 style={styles.title}>AI Extraction</h3>
        <p style={{ color: '#888', fontSize: 13 }}>No extraction data available yet.</p>
      </div>
    );
  }

  const fields = ocr.extracted_fields as Record<string, unknown>;

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>AI Extraction vs Finance Values</h3>
      <p style={styles.meta}>
        Extracted by {ocr.gemini_model} in {ocr.processing_ms}ms on{' '}
        {new Date(ocr.created_at).toLocaleString('en-GB')}
      </p>

      <div style={styles.grid}>
        <div style={styles.colHeader}>Field</div>
        <div style={styles.colHeader}>AI Extracted</div>
        <div style={styles.colHeader}>Finance Value</div>

        {FIELD_MAP.map(({ label, ocrKey, poKey }) => {
          const ocrVal = fields[ocrKey];
          const financeVal = po[poKey];
          const differs = ocrVal != null && financeVal != null &&
            String(ocrVal) !== String(financeVal);

          return (
            <>
              <div key={`${label}-l`} style={styles.cell}>{label}</div>
              <div key={`${label}-o`} style={{ ...styles.cell, color: '#555', fontFamily: 'monospace', fontSize: 12 }}>
                {ocrVal != null ? String(ocrVal) : <span style={{ color: '#bbb' }}>—</span>}
              </div>
              <div key={`${label}-f`} style={{
                ...styles.cell,
                background: differs ? '#fff3cd' : undefined,
                fontWeight: differs ? 600 : undefined,
              }}>
                {financeVal != null ? String(financeVal) : <span style={{ color: '#bbb' }}>—</span>}
                {differs && <span style={{ color: '#856404', marginLeft: 6, fontSize: 11 }}>edited</span>}
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
    padding: 16, marginBottom: 16,
  },
  title: { margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#1e3a5f' },
  meta: { margin: '0 0 12px', fontSize: 12, color: '#888' },
  grid: {
    display: 'grid', gridTemplateColumns: '160px 1fr 1fr',
    gap: '0', border: '1px solid #e9ecef', borderRadius: 4, overflow: 'hidden',
  },
  colHeader: {
    padding: '8px 10px', background: '#f8f9fa', fontWeight: 700,
    fontSize: 12, borderBottom: '1px solid #e9ecef',
  },
  cell: {
    padding: '7px 10px', fontSize: 13, borderBottom: '1px solid #f0f0f0',
    lineHeight: 1.4,
  },
};
