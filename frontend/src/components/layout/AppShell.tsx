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
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    background: 'var(--paper)',
  },
  inner: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '32px 40px 56px',
  },
};
