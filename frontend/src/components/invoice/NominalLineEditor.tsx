import type { NominalLine } from '../../lib/supabase';

interface NominalLineEditorProps {
  lineNumber: 1 | 2;
  value: Partial<NominalLine>;
  onChange: (updates: Partial<NominalLine>) => void;
  readOnly?: boolean;
}

export default function NominalLineEditor({
  lineNumber, value, onChange, readOnly = false,
}: NominalLineEditorProps) {
  const f = (key: keyof NominalLine, label: string, type: 'text' | 'number' = 'text') => (
    <div style={styles.field} key={key}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        style={styles.input}
        value={String(value[key] ?? '')}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange({ [key]: type === 'number' ? parseFloat(e.target.value) || null : e.target.value || null })}
      />
    </div>
  );

  return (
    <div style={styles.card}>
      <h4 style={styles.heading}>Nominal Line {lineNumber}</h4>
      <div style={styles.grid}>
        {f('transaction_value', 'Transaction Value', 'number')}
        {f('nominal_account_number', 'Account Number')}
        {f('nominal_cost_centre', 'Cost Centre')}
        {f('nominal_department', 'Department')}
        {f('transaction_analysis_code', 'Analysis Code')}
        {f('nominal_analysis_narrative', 'Narrative')}
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
