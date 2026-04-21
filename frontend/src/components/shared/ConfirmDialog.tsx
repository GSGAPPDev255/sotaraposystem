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
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.kicker}>§ Confirm</div>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button style={styles.cancel} onClick={onCancel}>{cancelLabel}</button>
          <button
            style={{ ...styles.confirm, ...(danger ? styles.danger : styles.primary) }}
            onClick={onConfirm}
          >
            {confirmLabel}
            <span style={styles.arrow}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(20, 24, 31, 0.42)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    animation: 'fadeIn 0.2s var(--ease)',
  },
  dialog: {
    background: 'var(--paper-bright)',
    border: '1px solid var(--line-strong)',
    borderRadius: 14,
    padding: '32px 34px 26px',
    maxWidth: 440, width: '100%',
    boxShadow: '0 24px 70px -20px rgba(20, 24, 31, 0.35)',
    animation: 'fadeRise 0.3s var(--ease)',
  },
  kicker: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--accent)',
    fontWeight: 500,
    letterSpacing: '0.1em',
    marginBottom: 10,
  },
  title: {
    margin: '0 0 10px',
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 400,
    color: 'var(--ink)',
    letterSpacing: '-0.015em',
    lineHeight: 1.15,
  },
  message: {
    margin: '0 0 22px',
    fontSize: 13.5,
    color: 'var(--ink-muted)',
    lineHeight: 1.6,
  },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancel: {
    padding: '9px 18px',
    background: 'transparent',
    border: '1px solid var(--line-strong)',
    color: 'var(--ink-soft)',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s var(--ease)',
  },
  confirm: {
    padding: '9px 18px',
    border: '1px solid transparent',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.15s var(--ease)',
  },
  primary: {
    background: 'var(--ink)',
    color: 'var(--paper)',
    borderColor: 'var(--ink)',
  },
  danger: {
    background: 'var(--danger)',
    color: '#fff',
    borderColor: 'var(--danger)',
  },
  arrow: { fontSize: 14, opacity: 0.7 },
};
