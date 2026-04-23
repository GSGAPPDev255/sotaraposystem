import type { ReactNode } from 'react';
import type { Profile } from '../../lib/supabase';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AppShellProps {
  profile: Profile;
  children: ReactNode;
}

export default function AppShell({ profile, children }: AppShellProps) {
  return (
    <div style={styles.shell}>
      {/* Ambient prism orbs — decorative, pointer-events none */}
      <div style={{ ...styles.orb, ...styles.orbTL }} aria-hidden />
      <div style={{ ...styles.orb, ...styles.orbBR }} aria-hidden />

      <Sidebar role={profile.role} />
      <div style={styles.main}>
        <TopBar profile={profile} />
        <main style={styles.content}>
          <div style={styles.inner}>{children}</div>
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--paper)',
    position: 'relative',
  },
  orb: {
    position: 'fixed',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 0,
  },
  orbTL: {
    top: -200,
    left: -100,
    width: 600,
    height: 600,
    background: 'radial-gradient(circle, rgba(0,180,216,0.07) 0%, transparent 65%)',
  },
  orbBR: {
    bottom: -200,
    right: -100,
    width: 500,
    height: 500,
    background: 'radial-gradient(circle, rgba(6,214,160,0.06) 0%, transparent 65%)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
    position: 'relative',
    zIndex: 1,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    background: 'transparent',
  },
  inner: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '32px 40px 56px',
  },
};
