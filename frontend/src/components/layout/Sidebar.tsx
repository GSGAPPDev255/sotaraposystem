import { NavLink } from 'react-router-dom';
import type { UserRole } from '../../lib/supabase';

const NAV_ITEMS: { label: string; path: string; roles: UserRole[] }[] = [
  { label: 'Dashboard', path: '/dashboard', roles: ['finance', 'admin', 'auditor'] },
  { label: 'Export',    path: '/export',    roles: ['finance', 'admin'] },
  { label: 'Admin',     path: '/admin',     roles: ['admin'] },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={styles.logoText}>Finance PO</span>
      </div>
      <nav>
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    background: '#1e3a5f',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logo: {
    padding: '20px 16px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  navItem: {
    display: 'block',
    padding: '12px 16px',
    color: 'rgba(255,255,255,0.8)',
    textDecoration: 'none',
    fontSize: 14,
    transition: 'background 0.15s',
    borderLeft: '3px solid transparent',
  },
  navItemActive: {
    color: '#fff',
    background: 'rgba(255,255,255,0.12)',
    borderLeft: '3px solid #4fc3f7',
  },
};
