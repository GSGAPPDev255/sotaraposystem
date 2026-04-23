import type { Profile } from '../../lib/supabase';
import { signOut } from '../../lib/auth';

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

interface TopBarProps {
  profile: Profile;
  onMenuClick: () => void;
}

export default function TopBar({ profile, onMenuClick }: TopBarProps) {
  const today = LONG_DATE.format(new Date());

  return (
    <header style={styles.bar}>
      <div style={styles.prismLine} aria-hidden />

      <div style={styles.leftSide}>
        {/* Hamburger — hidden on desktop via CSS */}
        <button
          className="topbar-hamburger"
          style={styles.hamburger}
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <span style={styles.hamburgerLine} />
          <span style={styles.hamburgerLine} />
          <span style={styles.hamburgerLine} />
        </button>

        {/* Date badge — hidden on mobile via CSS */}
        <div className="topbar-date-badge" style={styles.dateBadge}>
          <span style={styles.dateLabel}>Today</span>
          <span style={styles.dateValue}>{today}</span>
        </div>
      </div>

      <div style={styles.rightSide}>
        <div style={styles.user}>
          <div style={styles.userMeta}>
            <span style={styles.userName}>{profile.display_name}</span>
            <span style={styles.userRole}>{profile.role}</span>
          </div>
          <div style={styles.avatar} title={profile.display_name}>
            {initials(profile.display_name || profile.email)}
          </div>
        </div>

        <button style={styles.signOut} onClick={signOut}>
          <span className="topbar-sign-out-text">Sign out</span>
          <span className="topbar-sign-out-arrow" style={styles.signOutArrow} aria-hidden>→</span>
        </button>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 60,
    background: 'rgba(7, 9, 26, 0.70)',
    backdropFilter: 'blur(20px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    flexShrink: 0,
    position: 'relative',
    zIndex: 10,
  },
  prismLine: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
    background: 'linear-gradient(90deg, transparent 0%, rgba(0,180,216,0.4) 30%, rgba(6,214,160,0.3) 70%, transparent 100%)',
  },
  leftSide: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  hamburger: {
    display: 'none', // shown on mobile via CSS
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 5,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '7px 9px',
    cursor: 'pointer',
    width: 38,
    height: 38,
  },
  hamburgerLine: {
    display: 'block',
    width: 18,
    height: 1.5,
    background: 'rgba(240,244,255,0.7)',
    borderRadius: 2,
  },
  dateBadge: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 10,
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: 'rgba(240,244,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
    fontFamily: 'var(--font-display)',
  },
  dateValue: {
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    fontWeight: 300,
    color: 'rgba(240,244,255,0.65)',
    letterSpacing: '0.01em',
  },
  rightSide: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    lineHeight: 1.2,
  },
  userName: {
    fontSize: 13,
    fontWeight: 500,
    color: 'rgba(240,244,255,0.90)',
  },
  userRole: {
    fontSize: 9,
    color: 'rgba(240,244,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    marginTop: 2,
    fontWeight: 600,
    fontFamily: 'var(--font-display)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(0,180,216,0.3) 0%, rgba(6,214,160,0.3) 100%)',
    border: '1px solid rgba(0,198,224,0.35)',
    color: '#00C6E0',
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    fontFamily: 'var(--font-display)',
    boxShadow: '0 0 12px rgba(0,198,224,0.2)',
    flexShrink: 0,
  },
  signOut: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8,
    fontSize: 12,
    color: 'rgba(240,244,255,0.5)',
    fontWeight: 400,
    transition: 'all 0.15s var(--ease)',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
  },
  signOutArrow: {
    fontSize: 14,
    color: 'rgba(0,198,224,0.6)',
  },
};
