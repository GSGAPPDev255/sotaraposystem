import { format } from 'date-fns';
import type { AuditLogEntry } from '../../lib/supabase';

const ACTION_COLOURS: Record<string, string> = {
  created:        'var(--ink-faint)',
  ocr_completed:  'var(--info)',
  finance_edited: 'var(--accent)',
  status_changed: 'var(--ink-muted)',
  approval_sent:  'var(--info)',
  approved:       'var(--success)',
  rejected:       'var(--danger)',
  forwarded:      'var(--warning)',
  reminder_sent:  'var(--accent)',
  csv_generated:  'var(--success)',
  exported:       'var(--ink-faint)',
};

const ACTION_LABEL: Record<string, string> = {
  created:        'Invoice created',
  ocr_completed:  'AI extraction completed',
  finance_edited: 'Finance edited',
  status_changed: 'Status changed',
  approval_sent:  'Approval sent',
  approved:       'Approved',
  rejected:       'Rejected',
  forwarded:      'Forwarded',
  reminder_sent:  'Reminder sent',
  csv_generated:  'CSV generated',
  exported:       'Exported',
};

export default function AuditTimeline({ entries }: { entries: AuditLogEntry[] }) {
  if (!entries.length) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyMark}>§</div>
        <div style={styles.emptyText}>No audit history yet.</div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.rail} />

      {entries.map((entry, idx) => (
        <div key={entry.id} style={{
          ...styles.row,
          ...(idx === entries.length - 1 ? { marginBottom: 0 } : {}),
        }}>
          <div style={{
            ...styles.dot,
            background: ACTION_COLOURS[entry.action] ?? 'var(--ink-faint)',
          }} />

          <div style={styles.content}>
            <div style={styles.topLine}>
              <span style={styles.action}>
                {ACTION_LABEL[entry.action] ?? entry.action.replace(/_/g, ' ')}
              </span>
              <span style={styles.time}>
                {format(new Date(entry.created_at), 'dd MMM yyyy · HH:mm')}
              </span>
            </div>

            <div style={styles.actor}>
              <span style={styles.actorDash}>—</span>
              {entry.actor_display ?? entry.actor_email ?? 'System'}
            </div>

            {entry.new_values && Object.keys(entry.new_values).length > 0 && (
              <details style={styles.details}>
                <summary style={styles.summary}>View changes</summary>
                <pre style={styles.pre}>
                  {JSON.stringify(entry.new_values, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative', paddingLeft: 4 },
  rail: {
    position: 'absolute',
    left: 9,
    top: 8,
    bottom: 8,
    width: 1,
    background: 'var(--line-strong)',
  },
  row: {
    display: 'flex',
    gap: 18,
    marginBottom: 22,
    position: 'relative',
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: 4,
    boxShadow: '0 0 0 4px var(--paper-bright), 0 0 0 5px var(--line)',
    zIndex: 1,
  },
  content: { flex: 1, paddingBottom: 2, minWidth: 0 },
  topLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    flexWrap: 'wrap',
  },
  action: {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--ink)',
    letterSpacing: '-0.005em',
  },
  time: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
    color: 'var(--ink-faint)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  actor: {
    fontSize: 12,
    color: 'var(--ink-muted)',
    marginTop: 3,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  actorDash: { color: 'var(--ink-faint)', fontFamily: 'var(--font-display)' },
  details: { marginTop: 8 },
  summary: {
    fontSize: 11,
    color: 'var(--accent-text)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontWeight: 600,
  },
  pre: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    background: 'var(--paper)',
    border: '1px solid var(--line)',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
    overflow: 'auto',
    maxHeight: 200,
    color: 'var(--ink-soft)',
    lineHeight: 1.5,
  },
  empty: {
    padding: '32px 20px',
    textAlign: 'center',
  },
  emptyMark: {
    fontFamily: 'var(--font-display)',
    fontSize: 36,
    fontStyle: 'italic',
    color: 'var(--ink-faint)',
    opacity: 0.5,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 14,
    color: 'var(--ink-muted)',
  },
};
