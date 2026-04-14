import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import type { Profile } from './lib/supabase';
import { getCurrentProfile } from './lib/auth';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import FinanceDashboard from './pages/FinanceDashboard';
import InvoiceReview from './pages/InvoiceReview';
import ApproverView from './pages/ApproverView';
import ExportManagement from './pages/ExportManagement';
import AuditTrailViewer from './pages/AuditTrailViewer';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    // Use onAuthStateChange exclusively — INITIAL_SESSION fires immediately for
    // existing sessions, removing the duplicate getCurrentProfile() race condition.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          if (session) {
            const p = await getCurrentProfile();
            setProfile(p ?? null);
          } else {
            setProfile(null);
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          navigate('/login');
        }
      },
    );
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Loading state
  if (profile === undefined) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public — auth callback */}
      <Route path="/auth/callback" element={<AuthCallback onProfile={setProfile} />} />

      {/* Public login */}
      <Route
        path="/login"
        element={profile ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {/* Approver view — authenticated but accessible to approver role */}
      <Route
        path="/approve/:id"
        element={
          profile ? (
            <AppShell profile={profile}>
              <ApproverView />
            </AppShell>
          ) : (
            <Navigate to="/login" state={{ returnTo: window.location.pathname }} replace />
          )
        }
      />

      {/* Protected finance routes */}
      <Route
        path="/*"
        element={
          profile ? (
            <AppShell profile={profile}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<FinanceDashboard />} />
                <Route path="/invoices/:id" element={<InvoiceReview />} />
                <Route path="/export" element={<ExportManagement />} />
                <Route path="/audit/:id" element={<AuditTrailViewer />} />
                <Route
                  path="/admin"
                  element={
                    profile?.role === 'admin'
                      ? <AdminPanel />
                      : <Navigate to="/dashboard" replace />
                  }
                />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </AppShell>
          ) : (
            <Navigate to="/login" state={{ returnTo: window.location.pathname }} replace />
          )
        }
      />
    </Routes>
  );
}

function AuthCallback({ onProfile }: { onProfile: (p: Profile | null) => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const p = await getCurrentProfile();
        onProfile(p);
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    });
  }, [navigate, onProfile]);
  return <div style={styles.center}><div style={styles.spinner} /></div>;
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#f0f2f5',
  },
  spinner: {
    width: 40, height: 40,
    border: '4px solid #e0e0e0',
    borderTop: '4px solid #1e3a5f',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
