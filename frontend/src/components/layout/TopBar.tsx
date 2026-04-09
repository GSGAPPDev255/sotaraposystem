import type { Profile } from '../../lib/supabase';
import { signOut } from '../../lib/auth';

export default function TopBar({ profile }: { profile: Profile }) {
  return (
    <header style={styles.bar}>
      <div style={styles.userInfo}>
        <span style={styles.name}>{profile.display_name}</span>
        <span style={styles.role}>{profile.role}</span>
      </div>
      <button style={styles.signOut} onClick={signOut}>
        Sign out
      </button>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 56,
    background: '#fff',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 24px',
    gap: 16,
    flexShrink: 0,
  },
  userInfo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  name: { fontSize: 14, fontWeight: 600, color: '#333' },
  role: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  signOut: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid #ccc',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    color: '#555',
  },
};
