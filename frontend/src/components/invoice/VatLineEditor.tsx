import type { VatLine } from '../../lib/supabase';

interface VatLineEditorProps {
  lineNumber: 1 | 2;
  value: Partial<VatLine>;
  onChange: (updates: Partial<VatLine>) => void;
  readOnly?: boolean;
}

export default function VatLineEditor({
  lineNumber, value, onChange, readOnly = false,
}: VatLineEditorProps) {
  const num = (key: keyof VatLine, label: string) => (
    <div style={styles.field} key={key}>
      <label style={styles.label}>{label}</label>
      <input
        type="number"
        style={styles.input}
        value={String(value[key] ?? '')}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange({ [key]: parseFloat(e.target.value) || null })}
      />
    </div>
  );

  const txt = (key: keyof VatLine, label: string) => (
    <div style={styles.field} key={key}>
      <label style={styles.label}>{label}</label>
      <input
        type="text"
        style={styles.input}
        value={String(value[key] ?? '')}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange({ [key]: e.target.value || null })}
      />
    </div>
  );

  return (
    <div style={styles.card}>
      <h4 style={styles.heading}>VAT Line {lineNumber}</h4>
      <div style={styles.grid}>
        {num('tax_rate', 'Tax Rate (%)')}
        {txt('vat_code', 'VAT Code')}
        {num('goods_value_before_discount', 'Goods Value Before Discount')}
        {num('tax_on_goods_value', 'Tax on Goods Value')}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { border: '1px solid #e9ecef', borderRadius: 6, padding: 14, marginBottom: 12 },
  heading: { margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#495057' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' },
  field: { display: 'flex', flexDirection: 'column', gap: 3 },
  label: { fontSize: 12, color: '#666', fontWeight: 500 },
  input: {
    padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 4,
    fontSize: 13, outline: 'none',
  },
};
