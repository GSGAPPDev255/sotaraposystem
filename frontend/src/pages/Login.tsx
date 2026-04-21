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
      {/* Left — editorial marketing panel */}
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.brandRow} className="animate-rise">
            <div style={styles.mark}>S</div>
            <div style={styles.brandText}>
              <div style={styles.brandName}>Sotara</div>
              <div style={styles.brandKicker}>Ledger · Approvals</div>
            </div>
          </div>

          <div style={styles.heroWrap}>
            <p style={styles.eyebrow} className="animate-rise delay-1">
              <span style={styles.eyebrowRule} /> Internal Finance Portal
            </p>

            <h1 style={styles.hero} className="animate-rise delay-2">
              The quiet ledger,<br />
              <em style={styles.heroEm}>kept in order.</em>
            </h1>

            <p style={styles.lede} className="animate-rise delay-3">
              A bespoke workflow for reviewing supplier invoices, routing approvals,
              and exporting to Sage 200 — without the spreadsheet triage.
            </p>
          </div>

          <div style={styles.metricRow} className="animate-rise delay-4">
            <Metric number="01" label="Intake" text="MS 365 mailbox · Gemini extraction" />
            <div style={styles.metricDivider} />
            <Metric number="02" label="Approve" text="Azure AD · audit trail · reminders" />
            <div style={styles.metricDivider} />
            <Metric number="03" label="Export" text="Validated Sage 200 CSV" />
          </div>

          <div style={styles.footerLine}>
            <span style={styles.footerText}>UK · Finance only · Authorised access</span>
            <span style={styles.footerCode}>MMXXVI</span>
          </div>
        </div>
      </div>

      {/* Right — sign-in card */}
      <div style={styles.right}>
        <div style={styles.card} className="animate-rise delay-2">
          <div style={styles.cardKicker}>§ Sign in</div>
          <h2 style={styles.cardTitle}>Welcome back.</h2>
          <p style={styles.cardBody}>
            Authenticate with your Microsoft 365 account. Access is
            automatically restricted to authorised finance and management staff.
          </p>

          {error && (
            <div style={styles.error}>
              <span style={styles.errorLabel}>Error</span>
              <span>{error}</span>
            </div>
          )}

          <button
            className="btn"
            style={{
              ...styles.loginBtn,
              ...(loading ? { opacity: 0.7, cursor: 'wait' } : {}),
            }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <span style={styles.spinner} />
                Redirecting to Microsoft 365…
              </>
            ) : (
              <>
                <MicrosoftTiles />
                Continue with Microsoft 365
              </>
            )}
          </button>

          <div style={styles.helpBlock}>
            <div style={styles.helpLine}>
              <span style={styles.helpDot} />
              Finance, Approvers, Admins and Auditors
            </div>
            <div style={styles.helpLine}>
              <span style={styles.helpDot} />
              No password required — SSO only
            </div>
            <div style={styles.helpLine}>
              <span style={styles.helpDot} />
              Session protected by Azure AD policies
            </div>
          </div>

          <div style={styles.cardFoot}>
            Trouble signing in?{' '}
            <span style={styles.cardFootEm}>Contact the finance team.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ number, label, text }: { number: string; label: string; text: string }) {
  return (
    <div style={metricStyles.wrap}>
      <div style={metricStyles.number}>{number}</div>
      <div style={metricStyles.label}>{label}</div>
      <div style={metricStyles.text}>{text}</div>
    </div>
  );
}

function MicrosoftTiles() {
  const size = 14;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <rect x="0" y="0" width="7" height="7" fill="#F25022" />
      <rect x="9" y="0" width="7" height="7" fill="#7FBA00" />
      <rect x="0" y="9" width="7" height="7" fill="#00A4EF" />
      <rect x="9" y="9" width="7" height="7" fill="#FFB900" />
    </svg>
  );
}

const metricStyles: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, minWidth: 0 },
  number: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--accent)',
    fontWeight: 600,
    letterSpacing: '0.04em',
    marginBottom: 10,
  },
  label: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    fontWeight: 500,
    color: 'var(--ink)',
    marginBottom: 4,
    letterSpacing: '-0.01em',
  },
  text: {
    fontSize: 12,
    color: 'var(--ink-muted)',
    lineHeight: 1.55,
  },
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
    background: 'var(--paper)',
  },
  /* Left panel — editorial */
  left: {
    position: 'relative',
    padding: '56px 72px 48px',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--line)',
    background:
      'linear-gradient(180deg, var(--paper-bright) 0%, var(--paper) 100%)',
    overflow: 'hidden',
  },
  leftInner: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxWidth: 620,
    gap: 48,
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 14 },
  mark: {
    width: 42, height: 42, borderRadius: '50%',
    background: 'var(--ink)',
    color: 'var(--paper)',
    display: 'grid', placeItems: 'center',
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 24,
    fontWeight: 500,
    boxShadow: '0 0 0 4px rgba(20, 24, 31, 0.05)',
  },
  brandText: { display: 'flex', flexDirection: 'column', lineHeight: 1.1 },
  brandName: {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 500,
    color: 'var(--ink)',
    letterSpacing: '-0.015em',
  },
  brandKicker: {
    fontSize: 10, fontWeight: 600,
    color: 'var(--ink-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    marginTop: 4,
  },

  heroWrap: { display: 'flex', flexDirection: 'column', gap: 24 },
  eyebrow: {
    display: 'flex', alignItems: 'center', gap: 14,
    margin: 0,
    fontSize: 11, fontWeight: 600,
    color: 'var(--accent-text)',
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
  },
  eyebrowRule: {
    width: 32, height: 1, background: 'var(--accent)',
  },
  hero: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(38px, 5.4vw, 68px)',
    lineHeight: 1.02,
    letterSpacing: '-0.025em',
    color: 'var(--ink)',
    fontVariationSettings: "'opsz' 144, 'SOFT' 40",
    fontWeight: 400,
  },
  heroEm: {
    fontStyle: 'italic',
    fontVariationSettings: "'opsz' 144, 'SOFT' 100",
    color: 'var(--accent)',
  },
  lede: {
    margin: 0,
    maxWidth: 480,
    fontSize: 16,
    lineHeight: 1.6,
    color: 'var(--ink-muted)',
  },

  metricRow: {
    marginTop: 'auto',
    display: 'flex',
    gap: 28,
    paddingTop: 32,
    borderTop: '1px solid var(--line)',
  },
  metricDivider: {
    width: 1,
    background: 'var(--line)',
    alignSelf: 'stretch',
    marginTop: 4,
  },

  footerLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 10,
    color: 'var(--ink-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontWeight: 500,
  },
  footerText: {},
  footerCode: { fontFamily: 'var(--font-mono)' },

  /* Right panel — sign-in */
  right: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 56px',
    background: 'var(--paper)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--paper-bright)',
    border: '1px solid var(--line)',
    borderRadius: 14,
    padding: '38px 38px 32px',
    boxShadow: '0 1px 0 rgba(20, 24, 31, 0.03), 0 24px 60px -30px rgba(20, 24, 31, 0.25)',
    position: 'relative',
  },
  cardKicker: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--accent)',
    fontWeight: 500,
    letterSpacing: '0.1em',
    marginBottom: 14,
  },
  cardTitle: {
    margin: '0 0 12px',
    fontFamily: 'var(--font-display)',
    fontSize: 34,
    fontWeight: 400,
    color: 'var(--ink)',
    letterSpacing: '-0.02em',
    lineHeight: 1.05,
  },
  cardBody: {
    margin: '0 0 24px',
    fontSize: 13.5,
    lineHeight: 1.6,
    color: 'var(--ink-muted)',
  },
  error: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    padding: '10px 14px',
    background: 'var(--danger-soft)',
    border: '1px solid rgba(160, 49, 53, 0.25)',
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 12.5,
    color: 'var(--danger)',
  },
  errorLabel: {
    fontWeight: 700,
    fontSize: 9.5,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--danger)',
    flexShrink: 0,
  },
  loginBtn: {
    width: '100%',
    padding: '14px 20px',
    background: 'var(--ink)',
    color: 'var(--paper)',
    border: '1px solid var(--ink)',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '0.01em',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    transition: 'all 0.15s var(--ease)',
  },
  spinner: {
    width: 14, height: 14,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  helpBlock: {
    marginTop: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '16px 18px',
    background: 'var(--paper)',
    border: '1px dashed var(--line-strong)',
    borderRadius: 8,
  },
  helpLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
    color: 'var(--ink-muted)',
  },
  helpDot: {
    width: 4, height: 4, borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
  },
  cardFoot: {
    marginTop: 24,
    paddingTop: 18,
    borderTop: '1px solid var(--line)',
    fontSize: 12,
    color: 'var(--ink-faint)',
    textAlign: 'center',
  },
  cardFootEm: {
    color: 'var(--ink-muted)',
    fontStyle: 'italic',
    fontFamily: 'var(--font-display)',
    fontSize: 13,
  },
};
