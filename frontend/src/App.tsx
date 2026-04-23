import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import type { Profile } from './lib/supabase';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import FinanceDashboard from './pages/FinanceDashboard';
import InvoiceReview from './pages/InvoiceReview';
import ApproverView from './pages/ApproverView';
import ExportManagement from './pages/ExportManagement';
import AuditTrailViewer from './pages/AuditTrailViewer';
import AdminPanel from './pages/AdminPanel';
import ExpenseDashboard from './pages/ExpenseDashboard';
import ExpenseReview from './pages/ExpenseReview';
import ExpenseApprovalView from './pages/ExpenseApprovalView';
import ExpenseExport from './pages/ExpenseExport';
import MyExpenses from './pages/MyExpenses';
import MyExpenseDetail from './pages/MyExpenseDetail';

const PROFILE_CACHE_KEY = 'posystem_profile_cache';

function getCachedProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function setCachedProfile(p: Profile | null) {
  try {
    if (p) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch { /* storage full / private mode */ }
}

export default function App() {
  // Seed state from localStorage cache so the UI is instant on refresh.
  // `undefined` = still checking auth (show spinner).
  // `null`      = definitely not logged in (show login).
  // `Profile`   = logged in (show app).
  const [profile, setProfile] = useState<Profile | null | undefined>(() => {
    const cached = getCachedProfile();
    // If we have a cached profile start showing the app immediately;
    // auth validation happens in the background via onAuthStateChange.
    return cached ?? undefined;
  });

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    function applyProfile(p: Profile | null) {
      if (cancelled) return;
      setCachedProfile(p);
      setProfile(p);
    }

    function fetchProfile(userId: string) {
      // Supabase's query builder returns a PromiseLike (not a full Promise),
      // so .catch() isn't available — use the two-argument .then(onFulfilled, onRejected) form.
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .then(
          ({ data, error }) => {
            if (cancelled) return;
            if (error || !data) {
              console.warn('Profile load failed:', error?.message ?? 'no data');
              // Only clear profile/cache on definitive "not found" — not network errors
              applyProfile(null);
            } else {
              applyProfile(data as Profile);
            }
          },
          (err: unknown) => {
            // Network error: keep the cached profile rather than logging the user out.
            // The app will work with cached data; queries will fail gracefully.
            console.warn('Profile fetch network error — keeping cached state:', err);
            if (!cancelled) setProfile((prev) => (prev === undefined ? null : prev));
          },
        );
    }

    // Use getSession() for the page-refresh path instead of relying on
    // INITIAL_SESSION from onAuthStateChange. In Edge (and occasionally other
    // browsers) INITIAL_SESSION can fire before the auth token is fully
    // restored from storage, delivering a null session that overwrites the
    // profile cache and causes a redirect to /login.
    // getSession() reads directly from the in-memory session (already populated
    // from localStorage synchronously during Supabase client construction).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) fetchProfile(session.user.id);
      else applyProfile(null);
    });

    // Only listen for subsequent auth transitions — skip INITIAL_SESSION entirely.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) fetchProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          applyProfile(null);
          if (!cancelled) navigate('/login');
        }
      },
    );

    // Fallback: if profile is still undefined (no cache, auth slow) after 12s,
    // clear the spinner rather than hanging forever.
    const timeout = setTimeout(() => {
      if (!cancelled) setProfile((prev) => (prev === undefined ? null : prev));
    }, 12000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Only show the full-page spinner if there is no cached profile AND auth
  // hasn't resolved yet. With a cache hit this state is skipped entirely.
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
        element={
          profile
            ? <Navigate to={profile.role === 'staff' ? '/my-expenses' : '/dashboard'} replace />
            : <Login />
        }
      />

      {/* Approver view — invoice */}
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

      {/* Approver view — expense */}
      <Route
        path="/expenses/approve/:id"
        element={
          profile ? (
            <AppShell profile={profile}>
              <ExpenseApprovalView />
            </AppShell>
          ) : (
            <Navigate to="/login" state={{ returnTo: window.location.pathname }} replace />
          )
        }
      />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          profile ? (
            <AppShell profile={profile}>
              <Routes>
                {/* Root redirect — staff go to their portal, everyone else to dashboard */}
                <Route
                  path="/"
                  element={
                    <Navigate to={profile.role === 'staff' ? '/my-expenses' : '/dashboard'} replace />
                  }
                />

                {/* ── Staff-only routes ────────────────────────────── */}
                <Route
                  path="/my-expenses"
                  element={
                    profile.role === 'staff'
                      ? <MyExpenses />
                      : <Navigate to="/dashboard" replace />
                  }
                />
                <Route
                  path="/my-expenses/:id"
                  element={
                    profile.role === 'staff'
                      ? <MyExpenseDetail />
                      : <Navigate to="/dashboard" replace />
                  }
                />

                {/* ── Finance / admin / auditor routes ─────────────── */}
                <Route
                  path="/dashboard"
                  element={
                    profile.role !== 'staff'
                      ? <FinanceDashboard />
                      : <Navigate to="/my-expenses" replace />
                  }
                />
                <Route path="/invoices/:id" element={<InvoiceReview />} />
                <Route path="/export" element={<ExportManagement />} />
                <Route path="/audit/:id" element={<AuditTrailViewer />} />
                <Route path="/expenses" element={<ExpenseDashboard />} />
                <Route path="/expenses/:id" element={<ExpenseReview />} />
                <Route path="/expenses/export" element={<ExpenseExport />} />
                <Route
                  path="/admin"
                  element={
                    profile?.role === 'admin'
                      ? <AdminPanel />
                      : <Navigate to="/dashboard" replace />
                  }
                />

                <Route
                  path="*"
                  element={
                    <Navigate to={profile.role === 'staff' ? '/my-expenses' : '/dashboard'} replace />
                  }
                />
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
    let cancelled = false;
    let subscription: ReturnType<typeof supabase.auth.onAuthStateChange>['data']['subscription'] | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function handleSession(userId: string) {
      console.log('[AuthCallback] Fetching profile for userId:', userId);
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .then(
          ({ data, error }) => {
            if (cancelled) return;
            console.log('[AuthCallback] Profile fetch result:', { data, error });
            if (error) {
              console.error('[AuthCallback] Profile fetch error:', error);
              onProfile(null);
              navigate('/login', { replace: true });
              return;
            }
            const p = (data as Profile) ?? null;
            console.log('[AuthCallback] Setting profile:', p?.email);
            setCachedProfile(p);
            onProfile(p);
            const dest = p?.role === 'staff' ? '/my-expenses' : '/dashboard';
            console.log('[AuthCallback] Navigating to:', dest);
            navigate(dest, { replace: true });
          },
        );
    }

    console.log('[AuthCallback] Checking session...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthCallback] getSession returned:', { userId: session?.user?.id, email: session?.user?.email });
      if (cancelled) return;

      if (session?.user) {
        console.log('[AuthCallback] Session found, fetching profile');
        handleSession(session.user.id);
        return;
      }

      // Session not ready — wait for SIGNED_IN event (PKCE code exchange in progress)
      console.log('[AuthCallback] No session yet, waiting for SIGNED_IN event');
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (event, s) => {
          console.log('[AuthCallback] onAuthStateChange event:', event, { userId: s?.user?.id });
          if (cancelled) return;
          if (event === 'SIGNED_IN' && s?.user) {
            console.log('[AuthCallback] SIGNED_IN event received');
            if (timeout) clearTimeout(timeout);
            sub.unsubscribe();
            handleSession(s.user.id);
          } else if (event === 'SIGNED_OUT') {
            console.log('[AuthCallback] SIGNED_OUT event received');
            if (timeout) clearTimeout(timeout);
            sub.unsubscribe();
            navigate('/login', { replace: true });
          }
        },
      );
      subscription = sub;

      // Safety timeout in case code exchange fails
      timeout = setTimeout(() => {
        console.log('[AuthCallback] 15s timeout reached, redirecting to login');
        if (!cancelled) {
          sub.unsubscribe();
          navigate('/login', { replace: true });
        }
      }, 15000);
    });

    return () => {
      cancelled = true;
      if (subscription) subscription.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
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
// Build trigger
