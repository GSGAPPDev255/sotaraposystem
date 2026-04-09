interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button style={styles.cancel} onClick={onCancel}>{cancelLabel}</button>
          <button
            style={{ ...styles.confirm, ...(danger ? styles.danger : styles.primary) }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  dialog: {
    background: '#fff', borderRadius: 8, padding: 24,
    maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  title: { margin: '0 0 12px', fontSize: 18, color: '#333' },
  message: { margin: '0 0 20px', fontSize: 14, color: '#555', lineHeight: 1.5 },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  cancel: {
    padding: '8px 16px', background: '#fff', border: '1px solid #ccc',
    borderRadius: 4, cursor: 'pointer', fontSize: 14,
  },
  confirm: { padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  primary: { background: '#1e3a5f', color: '#fff' },
  danger: { background: '#dc3545', color: '#fff' },
};
