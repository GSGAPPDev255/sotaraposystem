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
        style={{
          ...styles.input,
          ...(type === 'number' ? { fontFamily: 'var(--font-mono)', fontSize: 12.5 } : {}),
          ...(readOnly ? styles.inputReadOnly : {}),
        }}
        value={String(value[key] ?? '')}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange({ [key]: type === 'number' ? parseFloat(e.target.value) || null : e.target.value || null })}
      />
    </div>
  );

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.lineTag}>Line {lineNumber.toString().padStart(2, '0')}</span>
        <span style={styles.rule} />
      </div>
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
  card: {
    border: '1px dashed var(--line-strong)',
    borderRadius: 8,
    padding: '16px 18px',
    marginBottom: 12,
    background: 'var(--paper)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  lineTag: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
    color: 'var(--accent)',
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  rule: { flex: 1, height: 1, background: 'var(--line)' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 18px' },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: {
    fontSize: 10,
    color: 'var(--ink-faint)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  },
  input: {
    padding: '8px 11px',
    border: '1px solid var(--line-strong)',
    borderRadius: 6,
    fontSize: 13,
    background: 'var(--paper-bright)',
    color: 'var(--ink)',
    outline: 'none',
    transition: 'border-color 0.15s var(--ease)',
  },
  inputReadOnly: {
    background: 'transparent',
    color: 'var(--ink-soft)',
    cursor: 'default',
  },
};
