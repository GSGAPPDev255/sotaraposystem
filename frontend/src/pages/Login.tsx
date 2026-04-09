import { useState } from 'react';
import { signInWithAzureAD } from '../lib/auth';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithAzureAD();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Finance PO System</h1>
          <p style={styles.subtitle}>Invoice Approval & Sage 200 Export</p>
        </div>

        <div style={styles.body}>
          <p style={styles.description}>
            Sign in with your Microsoft 365 account to access the finance portal.
          </p>

          {error && (
            <div style={styles.error}>{error}</div>
          )}

          <button
            style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Redirecting…' : 'Sign in with Microsoft 365'}
          </button>
        </div>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Access is restricted to authorised finance and management staff.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#f0f2f5',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  card: {
    background: '#fff', borderRadius: 12, overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: '100%', maxWidth: 400,
  },
  header: {
    background: '#1e3a5f', padding: '32px 32px 24px', textAlign: 'center',
  },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' },
  subtitle: { margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  body: { padding: '28px 32px' },
  description: { margin: '0 0 20px', fontSize: 14, color: '#555', lineHeight: 1.6, textAlign: 'center' },
  error: {
    background: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7',
    borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13,
  },
  btn: {
    width: '100%', padding: '12px 0', background: '#0078d4', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footer: { borderTop: '1px solid #f0f0f0', padding: '14px 32px' },
  footerText: { margin: 0, fontSize: 12, color: '#999', textAlign: 'center' },
};
