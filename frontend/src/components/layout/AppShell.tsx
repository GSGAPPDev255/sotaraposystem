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
        <main style={styles.content}>{children}</main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', height: '100vh', overflow: 'hidden' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content: { flex: 1, overflowY: 'auto', padding: 24, background: '#f0f2f5' },
};
