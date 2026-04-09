import { format } from 'date-fns';
import type { AuditLogEntry } from '../../lib/supabase';

const ACTION_COLORS: Record<string, string> = {
  created:        '#6c757d',
  ocr_completed:  '#0d6efd',
  finance_edited: '#fd7e14',
  status_changed: '#6f42c1',
  approval_sent:  '#0dcaf0',
  approved:       '#198754',
  rejected:       '#dc3545',
  forwarded:      '#ffc107',
  reminder_sent:  '#e83e8c',
  csv_generated:  '#20c997',
  exported:       '#6c757d',
};

export default function AuditTimeline({ entries }: { entries: AuditLogEntry[] }) {
  if (!entries.length) {
    return <p style={{ color: '#888', fontSize: 14 }}>No audit history yet.</p>;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Vertical line */}
      <div style={{
        position: 'absolute', left: 11, top: 0, bottom: 0,
        width: 2, background: '#e9ecef',
      }} />

      {entries.map((entry) => (
        <div key={entry.id} style={{ display: 'flex', gap: 16, marginBottom: 20, position: 'relative' }}>
          {/* Dot */}
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: ACTION_COLORS[entry.action] ?? '#6c757d',
            border: '3px solid #fff',
            boxShadow: '0 0 0 2px #dee2e6',
            zIndex: 1,
          }} />

          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>
                {entry.action.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 12, color: '#888' }}>
                {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
              </span>
            </div>

            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              {entry.actor_display ?? entry.actor_email ?? 'System'}
            </div>

            {entry.new_values && Object.keys(entry.new_values).length > 0 && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 12, color: '#0d6efd', cursor: 'pointer' }}>
                  View changes
                </summary>
                <pre style={{
                  fontSize: 11, background: '#f8f9fa', padding: 8, borderRadius: 4,
                  marginTop: 4, overflow: 'auto', maxHeight: 200,
                }}>
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
