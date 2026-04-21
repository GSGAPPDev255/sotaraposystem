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

export default function TopBar({ profile }: { profile: Profile }) {
  const today = LONG_DATE.format(new Date());

  return (
    <header style={styles.bar}>
      <div style={styles.leftSide}>
        <span style={styles.dateBadge}>
          <span style={styles.dateLabel}>Today</span>
          <span style={styles.dateValue}>{today}</span>
        </span>
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
          Sign out
          <span style={styles.signOutArrow} aria-hidden>→</span>
        </button>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 64,
    background: 'var(--paper)',
    borderBottom: '1px solid var(--line)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 40px',
    flexShrink: 0,
  },
  leftSide: { display: 'flex', alignItems: 'center', gap: 14 },
  dateBadge: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 10,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--ink-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
  },
  dateValue: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 15,
    color: 'var(--ink-soft)',
    letterSpacing: '-0.005em',
  },
  rightSide: { display: 'flex', alignItems: 'center', gap: 20 },
  user: { display: 'flex', alignItems: 'center', gap: 12 },
  userMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 },
  userName: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink)',
  },
  userRole: {
    fontSize: 10,
    color: 'var(--ink-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    marginTop: 3,
    fontWeight: 500,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'var(--ink)',
    color: 'var(--paper)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.05em',
    boxShadow: '0 0 0 1px var(--line-strong), 0 0 0 3px var(--paper)',
  },
  signOut: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    background: 'transparent',
    border: '1px solid var(--line-strong)',
    borderRadius: 'var(--radius)',
    fontSize: 12,
    color: 'var(--ink-soft)',
    fontWeight: 500,
    transition: 'all 0.15s var(--ease)',
  },
  signOutArrow: {
    fontSize: 14,
    color: 'var(--ink-faint)',
    transform: 'translateY(-1px)',
  },
};
