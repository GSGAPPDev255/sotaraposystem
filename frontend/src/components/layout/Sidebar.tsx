import { NavLink } from 'react-router-dom';
import type { UserRole } from '../../lib/supabase';

const NAV_ITEMS: { label: string; path: string; roles: UserRole[]; number: string }[] = [
  { number: '01', label: 'Dashboard', path: '/dashboard', roles: ['finance', 'admin', 'auditor'] },
  { number: '02', label: 'Export',    path: '/export',    roles: ['finance', 'admin'] },
  { number: '03', label: 'Admin',     path: '/admin',     roles: ['admin'] },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <aside style={styles.sidebar}>
      {/* Brand wordmark */}
      <div style={styles.brand}>
        <div style={styles.brandMark}>S</div>
        <div style={styles.brandText}>
          <div style={styles.brandName}>Sotara</div>
          <div style={styles.brandSub}>Ledger · Approvals</div>
        </div>
      </div>

      {/* Section label */}
      <div style={styles.sectionLabel}>Navigate</div>

      {/* Nav */}
      <nav style={styles.nav}>
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{ ...styles.navNumber, ...(isActive ? styles.navNumberActive : {}) }}>
                  {item.number}
                </span>
                <span style={styles.navLabel}>{item.label}</span>
                {isActive && <span style={styles.navDot} aria-hidden />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer — hairline seal */}
      <div style={styles.seal}>
        <div style={styles.sealLine} />
        <div style={styles.sealText}>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            est. 2026
          </div>
          <div style={styles.sealYear}>UK · Sage 200</div>
        </div>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 232,
    background: 'var(--ink)',
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'relative',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    /* A whisper of the copper accent as a vertical rule on the right edge */
    backgroundImage:
      'linear-gradient(180deg, rgba(181, 78, 28, 0.0) 0%, rgba(181, 78, 28, 0.6) 30%, rgba(181, 78, 28, 0.6) 70%, rgba(181, 78, 28, 0) 100%)',
    backgroundSize: '1px 100%',
    backgroundPosition: 'right 0',
    backgroundRepeat: 'no-repeat',
  },
  brand: {
    padding: '28px 24px 26px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 500,
    fontStyle: 'italic',
    boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.18), 0 0 0 4px rgba(181, 78, 28, 0.14)',
  },
  brandText: { display: 'flex', flexDirection: 'column', lineHeight: 1.1 },
  brandName: {
    fontFamily: 'var(--font-display)',
    fontSize: 21,
    fontWeight: 500,
    color: '#fff',
    letterSpacing: '-0.015em',
  },
  brandSub: {
    fontSize: 10,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    marginTop: 4,
  },
  sectionLabel: {
    padding: '28px 24px 10px',
    fontSize: 10,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
  },
  nav: { display: 'flex', flexDirection: 'column', padding: '0 12px' },
  navItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '13px 14px',
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 400,
    borderRadius: 6,
    transition: 'all 0.18s var(--ease)',
  },
  navItemActive: {
    color: '#fff',
    background: 'rgba(255,255,255,0.04)',
  },
  navNumber: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 500,
    letterSpacing: '0.05em',
  },
  navNumberActive: { color: 'var(--accent)' },
  navLabel: { flex: 1 },
  navDot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'var(--accent)',
    boxShadow: '0 0 0 4px rgba(181, 78, 28, 0.2)',
  },
  seal: {
    marginTop: 'auto',
    padding: '20px 24px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  sealLine: {
    width: 28,
    height: 1,
    background: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  sealText: { display: 'flex', flexDirection: 'column', gap: 2 },
  sealYear: {
    fontSize: 10,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
  },
};
