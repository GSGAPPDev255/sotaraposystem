import { NavLink } from 'react-router-dom';
import type { UserRole } from '../../lib/supabase';

const NAV_ITEMS: { label: string; path: string; roles: UserRole[]; number: string }[] = [
  { number: '01', label: 'Dashboard', path: '/dashboard', roles: ['finance', 'admin', 'auditor'] },
  { number: '02', label: 'Export',    path: '/export',    roles: ['finance', 'admin'] },
  { number: '03', label: 'Admin',     path: '/admin',     roles: ['admin'] },
];

/** Sotara infinity mark — matches the actual logo SVG */
function SotaraInfinityMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 100 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#00B4D8" />
          <stop offset="100%" stopColor="#06D6A0" />
        </linearGradient>
      </defs>
      {/* Lemniscate / infinity shape */}
      <path
        d="M50 30 C50 30 38 10 22 10 C10 10 2 18 2 30 C2 42 10 50 22 50 C38 50 50 30 50 30 Z"
        stroke="url(#sb-grad)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M50 30 C50 30 62 50 78 50 C90 50 98 42 98 30 C98 18 90 10 78 10 C62 10 50 30 50 30 Z"
        stroke="url(#sb-grad)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function Sidebar({ role }: { role: UserRole }) {
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <aside style={styles.sidebar}>
      {/* Subtle prism glow orb top */}
      <div style={styles.glowOrb} aria-hidden />

      {/* Brand */}
      <div style={styles.brand}>
        <SotaraInfinityMark size={44} />
        <div style={styles.brandWordmark}>SOTARA</div>
      </div>

      {/* Divider */}
      <div style={styles.divider} />

      {/* Section label */}
      <div style={styles.sectionLabel}>Navigation</div>

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
                <span style={{
                  ...styles.navNumber,
                  ...(isActive ? styles.navNumberActive : {}),
                }}>
                  {item.number}
                </span>
                <span style={styles.navLabel}>{item.label}</span>
                {isActive && <span style={styles.navPip} aria-hidden />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom brand mark */}
      <div style={styles.footer}>
        <div style={styles.footerInner}>
          <div style={styles.footerGradientLine} />
          <span style={styles.footerText}>Invoice Approvals</span>
        </div>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    background: 'rgba(7, 9, 26, 0.85)',
    backdropFilter: 'blur(24px) saturate(1.8)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
    color: 'rgba(240, 244, 255, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'relative',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -60,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,180,216,0.18) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  brand: {
    padding: '28px 22px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    position: 'relative',
  },
  brandWordmark: {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '0.18em',
    background: 'linear-gradient(135deg, #00B4D8 0%, #06D6A0 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
  },
  divider: {
    height: 1,
    margin: '0 22px',
    background: 'linear-gradient(90deg, rgba(0,198,224,0.4) 0%, rgba(6,214,160,0.2) 60%, transparent 100%)',
  },
  sectionLabel: {
    padding: '20px 22px 8px',
    fontSize: 9,
    fontWeight: 700,
    color: 'rgba(240,244,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
    fontFamily: 'var(--font-display)',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '4px 10px',
    gap: 2,
  },
  navItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 14px',
    color: 'rgba(240,244,255,0.55)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 400,
    borderRadius: 8,
    transition: 'all 0.18s var(--ease)',
  },
  navItemActive: {
    color: 'rgba(240,244,255,0.95)',
    background: 'rgba(0, 198, 224, 0.09)',
    borderColor: 'rgba(0,198,224,0.2)',
  },
  navNumber: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'rgba(240,244,255,0.25)',
    fontWeight: 500,
    letterSpacing: '0.08em',
    minWidth: 18,
  },
  navNumberActive: {
    background: 'linear-gradient(135deg, #00B4D8 0%, #06D6A0 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  navLabel: { flex: 1 },
  navPip: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--brand-gradient)',
    boxShadow: '0 0 8px rgba(0,198,224,0.8)',
  },
  footer: {
    marginTop: 'auto',
    padding: '20px 22px 28px',
  },
  footerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  footerGradientLine: {
    width: 20,
    height: 1,
    background: 'linear-gradient(90deg, #00B4D8, #06D6A0)',
    opacity: 0.6,
    flexShrink: 0,
  },
  footerText: {
    fontSize: 9,
    fontWeight: 600,
    color: 'rgba(240,244,255,0.25)',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontFamily: 'var(--font-display)',
  },
};
