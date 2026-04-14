/**
 * AdminPanel — four tabs:
 *  1. Users      — view all profiles, change roles, activate/deactivate
 *  2. Approvers  — manage approver list, add manual entries, trigger AD sync
 *  3. Alerts     — configure CC emails, admin notification address
 *  4. System     — view function health, trigger email-intake manually
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, Approver, UserRole } from '../lib/supabase';

type Tab = 'users' | 'approvers' | 'alerts' | 'system';

interface SystemSetting { key: string; value: string; description: string }

const ROLE_OPTIONS: UserRole[] = ['finance', 'approver', 'auditor', 'admin'];

const ROLE_COLOURS: Record<UserRole, { bg: string; color: string }> = {
  admin:    { bg: '#fef3c7', color: '#92400e' },
  finance:  { bg: '#dbeafe', color: '#1e40af' },
  approver: { bg: '#dcfce7', color: '#166534' },
  auditor:  { bg: '#f3e8ff', color: '#6b21a8' },
};

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Admin Panel</h1>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {(['users', 'approvers', 'alerts', 'system'] as Tab[]).map((t) => (
          <button
            key={t}
            style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={s.content}>
        {tab === 'users'     && <UsersTab />}
        {tab === 'approvers' && <ApproversTab />}
        {tab === 'alerts'    && <AlertsTab />}
        {tab === 'system'    && <SystemTab />}
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('display_name');
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeRole(id: string, role: UserRole) {
    setSaving(id);
    const { error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { setMsg('Error: ' + error.message); }
    else { setMsg('Role updated.'); await load(); }
    setSaving(null);
    setTimeout(() => setMsg(''), 3000);
  }

  async function toggleActive(id: string, current: boolean) {
    setSaving(id);
    const { error } = await supabase.from('profiles').update({ is_active: !current, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { setMsg('Error: ' + error.message); }
    else { setMsg('Status updated.'); await load(); }
    setSaving(null);
    setTimeout(() => setMsg(''), 3000);
  }

  if (loading) return <div style={s.loading}>Loading users…</div>;

  return (
    <div>
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>System Users</div>
          <div style={s.sectionSub}>All users who have signed in. Change roles or deactivate accounts here.</div>
        </div>
        {msg && <div style={s.toast}>{msg}</div>}
      </div>
      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Name</th>
              <th style={s.th}>Email</th>
              <th style={s.th}>Role</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Joined</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} style={s.row}>
                <td style={s.td}>
                  <div style={s.name}>{p.display_name}</div>
                </td>
                <td style={s.td}><span style={s.mono}>{p.email}</span></td>
                <td style={s.td}>
                  <span style={{ ...s.roleBadge, ...ROLE_COLOURS[p.role] }}>{p.role}</span>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.statusDot, background: p.is_active ? '#22c55e' : '#e5e7eb' }} />
                  {p.is_active ? 'Active' : 'Inactive'}
                </td>
                <td style={s.td}>{new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                <td style={s.td}>
                  <select
                    style={s.select}
                    value={p.role}
                    disabled={saving === p.id}
                    onChange={(e) => changeRole(p.id, e.target.value as UserRole)}
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button
                    style={{ ...s.btn, ...(p.is_active ? s.btnDanger : s.btnSecondary) }}
                    disabled={saving === p.id}
                    onClick={() => toggleActive(p.id, p.is_active)}
                  >
                    {saving === p.id ? '…' : p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {profiles.length === 0 && <div style={s.empty}>No users yet.</div>}
      </div>
    </div>
  );
}

// ─── Approvers Tab ────────────────────────────────────────────────────────────

interface NewApprover { display_name: string; email: string; department: string }
const EMPTY_NEW: NewApprover = { display_name: '', email: '', department: '' };

function ApproversTab() {
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [removing, setRemoving]   = useState<string | null>(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState<NewApprover>(EMPTY_NEW);
  const [msg, setMsg]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('approvers').select('*').order('display_name');
    setApprovers((data as Approver[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 4000); }

  async function triggerSync() {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-approvers', { method: 'POST' });
      if (error) flash('Sync error: ' + error.message);
      else { flash('Sync complete — approver list refreshed from Azure AD.'); await load(); }
    } catch (e) { flash('Sync failed: ' + (e as Error).message); }
    setSyncing(false);
  }

  async function toggleApprover(id: string, current: boolean) {
    setRemoving(id);
    const { error } = await supabase.from('approvers').update({ is_active: !current }).eq('id', id);
    if (error) flash('Error: ' + error.message);
    else { flash('Approver status updated.'); await load(); }
    setRemoving(null);
  }

  async function addApprover() {
    if (!form.display_name.trim() || !form.email.trim()) {
      flash('Name and email are required.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('approvers').insert({
      azure_oid:    null,
      display_name: form.display_name.trim(),
      email:        form.email.trim().toLowerCase(),
      department:   form.department.trim() || null,
      is_active:    true,
      synced_at:    new Date().toISOString(),
    });
    if (error) flash('Error: ' + error.message);
    else { flash('Approver added.'); setForm(EMPTY_NEW); setShowAdd(false); await load(); }
    setSaving(false);
  }

  if (loading) return <div style={s.loading}>Loading approvers…</div>;

  return (
    <div>
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>Approvers</div>
          <div style={s.sectionSub}>People who can approve invoices. Synced from Azure AD daily, or add manually.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {msg && <div style={s.toast}>{msg}</div>}
          <button style={s.btnSecondary} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'Cancel' : '+ Add Manually'}
          </button>
          <button style={s.btnPrimary} onClick={triggerSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync from Azure AD'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div style={s.addForm}>
          <div style={s.addFormTitle}>Add Manual Approver</div>
          <div style={s.formGrid}>
            <div style={s.formGroup}>
              <label style={s.label}>Full Name *</label>
              <input style={s.input} value={form.display_name} placeholder="e.g. Jane Smith"
                onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Email Address *</label>
              <input style={s.input} type="email" value={form.email} placeholder="jane@gardenerschools.com"
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Department</label>
              <input style={s.input} value={form.department} placeholder="e.g. Finance"
                onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <button style={s.btnPrimary} disabled={saving} onClick={addApprover}>
            {saving ? 'Saving…' : 'Add Approver'}
          </button>
        </div>
      )}

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Name</th>
              <th style={s.th}>Email</th>
              <th style={s.th}>Department</th>
              <th style={s.th}>Source</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {approvers.map((a) => (
              <tr key={a.id} style={{ ...s.row, opacity: a.is_active ? 1 : 0.5 }}>
                <td style={s.td}><div style={s.name}>{a.display_name}</div></td>
                <td style={s.td}><span style={s.mono}>{a.email}</span></td>
                <td style={s.td}>{a.department ?? <span style={{ color: '#bbb' }}>—</span>}</td>
                <td style={s.td}>
                  <span style={a.azure_oid ? s.badgeAzure : s.badgeManual}>
                    {a.azure_oid ? 'Azure AD' : 'Manual'}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.statusDot, background: a.is_active ? '#22c55e' : '#e5e7eb' }} />
                  {a.is_active ? 'Active' : 'Inactive'}
                </td>
                <td style={s.td}>
                  <button
                    style={{ ...s.btn, ...(a.is_active ? s.btnDanger : s.btnSecondary) }}
                    disabled={removing === a.id}
                    onClick={() => toggleApprover(a.id, a.is_active)}
                  >
                    {removing === a.id ? '…' : a.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {approvers.length === 0 && (
          <div style={s.empty}>No approvers yet. Click "Sync from Azure AD" or add one manually.</div>
        )}
      </div>
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

const ALERT_KEYS = ['alert_cc_emails', 'admin_alert_email', 'reminder_days', 'max_reminders'];

function AlertsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [descs, setDescs]       = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('system_settings').select('*');
      const vals: Record<string, string> = {};
      const ds: Record<string, string> = {};
      for (const row of (data as SystemSetting[]) ?? []) {
        vals[row.key] = row.value ?? '';
        ds[row.key]   = row.description ?? '';
      }
      setSettings(vals);
      setDescs(ds);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const updates = ALERT_KEYS.map((key) =>
      supabase.from('system_settings').upsert({
        key,
        value: settings[key] ?? '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
    );
    const results = await Promise.all(updates);
    const errs = results.filter((r) => r.error);
    if (errs.length) setMsg('Some settings failed to save.');
    else setMsg('Settings saved.');
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  }

  if (loading) return <div style={s.loading}>Loading settings…</div>;

  return (
    <div>
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>Alert & Notification Settings</div>
          <div style={s.sectionSub}>Configure who receives emails and how reminders behave.</div>
        </div>
        {msg && <div style={s.toast}>{msg}</div>}
      </div>

      <div style={s.card}>
        <div style={s.settingsGrid}>

          <div style={s.settingRow}>
            <div style={s.settingLabel}>
              <div style={s.settingKey}>CC Emails on Approvals</div>
              <div style={s.settingDesc}>{descs['alert_cc_emails'] ?? 'Comma-separated emails CCed on all approval request emails'}</div>
            </div>
            <input
              style={{ ...s.input, width: 380 }}
              value={settings['alert_cc_emails'] ?? ''}
              placeholder="finance@school.com, head@school.com"
              onChange={(e) => setSettings({ ...settings, alert_cc_emails: e.target.value })}
            />
          </div>

          <div style={s.settingRow}>
            <div style={s.settingLabel}>
              <div style={s.settingKey}>Admin Alert Email</div>
              <div style={s.settingDesc}>{descs['admin_alert_email'] ?? 'Receives alerts when system errors occur'}</div>
            </div>
            <input
              style={{ ...s.input, width: 380 }}
              type="email"
              value={settings['admin_alert_email'] ?? ''}
              placeholder="admin@gardenerschools.com"
              onChange={(e) => setSettings({ ...settings, admin_alert_email: e.target.value })}
            />
          </div>

          <div style={s.settingRow}>
            <div style={s.settingLabel}>
              <div style={s.settingKey}>Reminder After (days)</div>
              <div style={s.settingDesc}>{descs['reminder_days'] ?? 'Days to wait before sending approval reminder'}</div>
            </div>
            <input
              style={{ ...s.input, width: 100 }}
              type="number"
              min={1}
              max={30}
              value={settings['reminder_days'] ?? '3'}
              onChange={(e) => setSettings({ ...settings, reminder_days: e.target.value })}
            />
          </div>

          <div style={s.settingRow}>
            <div style={s.settingLabel}>
              <div style={s.settingKey}>Max Reminders</div>
              <div style={s.settingDesc}>{descs['max_reminders'] ?? 'Maximum reminders per invoice before escalating'}</div>
            </div>
            <input
              style={{ ...s.input, width: 100 }}
              type="number"
              min={1}
              max={10}
              value={settings['max_reminders'] ?? '3'}
              onChange={(e) => setSettings({ ...settings, max_reminders: e.target.value })}
            />
          </div>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          <button style={s.btnPrimary} disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── System Tab ───────────────────────────────────────────────────────────────

interface FnStatus { name: string; label: string; schedule: string }

const FUNCTIONS: FnStatus[] = [
  { name: 'email-intake',       label: 'Email Intake',       schedule: 'Every 5 minutes' },
  { name: 'sync-approvers',     label: 'Sync Approvers',     schedule: 'Daily at 07:00 UTC' },
  { name: 'reminder-scheduler', label: 'Reminder Scheduler', schedule: 'Daily at 08:00 UTC' },
  { name: 'gemini-processor',   label: 'Gemini Processor',   schedule: 'On-demand (per invoice)' },
  { name: 'send-approval',      label: 'Send Approval',      schedule: 'On-demand (per invoice)' },
  { name: 'process-approval',   label: 'Process Approval',   schedule: 'On-demand (approver click)' },
  { name: 'generate-csv',       label: 'Generate CSV',       schedule: 'On-demand (export page)' },
];

function SystemTab() {
  const [triggering, setTriggering] = useState<string | null>(null);
  const [results, setResults]       = useState<Record<string, string>>({});
  const [stats, setStats]           = useState<{ pos: number; files: number; exports: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [posRes, filesRes, exportsRes] = await Promise.all([
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }),
        supabase.from('invoice_files').select('id', { count: 'exact', head: true }),
        supabase.from('csv_exports').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        pos:     posRes.count ?? 0,
        files:   filesRes.count ?? 0,
        exports: exportsRes.count ?? 0,
      });
    })();
  }, []);

  async function trigger(name: string) {
    setTriggering(name);
    setResults((r) => ({ ...r, [name]: 'Running…' }));
    try {
      const { data, error } = await supabase.functions.invoke(name, { method: 'POST' });
      if (error) {
        setResults((r) => ({ ...r, [name]: 'Error: ' + error.message }));
      } else {
        const text = typeof data === 'object' ? JSON.stringify(data) : String(data);
        setResults((r) => ({ ...r, [name]: text }));
      }
    } catch (e) {
      setResults((r) => ({ ...r, [name]: 'Failed: ' + (e as Error).message }));
    }
    setTriggering(null);
  }

  return (
    <div>
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>System Health & Controls</div>
          <div style={s.sectionSub}>Database stats and manual function triggers. Use these to test or recover from issues.</div>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statValue}>{stats.files}</div>
            <div style={s.statLabel}>Invoice Files</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statValue}>{stats.pos}</div>
            <div style={s.statLabel}>Purchase Orders</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statValue}>{stats.exports}</div>
            <div style={s.statLabel}>Sage Exports</div>
          </div>
        </div>
      )}

      {/* Azure AD fix notice */}
      <div style={s.warningBox}>
        <div style={s.warningTitle}>⚠ Email Intake is returning errors</div>
        <div style={s.warningBody}>
          The <strong>email-intake</strong> and <strong>sync-approvers</strong> functions are failing because
          the Azure App Registration needs <strong>Application permissions</strong> (not just Delegated) for
          Microsoft Graph. Follow these steps to fix it:
          <ol style={{ marginTop: 8, paddingLeft: 20, lineHeight: '1.8' }}>
            <li>Open <strong>Azure Portal → App Registrations → your app → API Permissions</strong></li>
            <li>Click <strong>Add a permission → Microsoft Graph → Application permissions</strong></li>
            <li>Add: <code style={s.code}>Mail.ReadWrite</code> and <code style={s.code}>User.Read.All</code></li>
            <li>Click <strong>Grant admin consent</strong> (requires Azure AD Global Admin)</li>
            <li>Come back here and click <strong>Run</strong> next to Email Intake to test</li>
          </ol>
        </div>
      </div>

      {/* Function cards */}
      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Function</th>
              <th style={s.th}>Schedule</th>
              <th style={s.th}>Last Result</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {FUNCTIONS.map((fn) => (
              <tr key={fn.name} style={s.row}>
                <td style={s.td}><div style={s.name}>{fn.label}</div><div style={{ ...s.mono, fontSize: 11, color: '#999' }}>{fn.name}</div></td>
                <td style={s.td}>{fn.schedule}</td>
                <td style={s.td}>
                  {results[fn.name] ? (
                    <span style={{
                      ...s.mono,
                      fontSize: 11,
                      color: results[fn.name].startsWith('Error') || results[fn.name].startsWith('Failed')
                        ? '#dc2626' : '#166534',
                    }}>
                      {results[fn.name].length > 120
                        ? results[fn.name].slice(0, 120) + '…'
                        : results[fn.name]}
                    </span>
                  ) : (
                    <span style={{ color: '#bbb', fontSize: 12 }}>—</span>
                  )}
                </td>
                <td style={s.td}>
                  <button
                    style={s.btnSecondary}
                    disabled={triggering === fn.name}
                    onClick={() => trigger(fn.name)}
                  >
                    {triggering === fn.name ? 'Running…' : 'Run Now'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  pageHeader:   { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  pageTitle:    { margin: 0, fontSize: 22, fontWeight: 700, color: '#1e3a5f' },
  tabBar:       { display: 'flex', gap: 0, borderBottom: '2px solid #e9ecef', marginBottom: 24 },
  tab:          { padding: '10px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6c757d', fontWeight: 500, borderBottom: '2px solid transparent', marginBottom: -2 },
  tabActive:    { color: '#1e3a5f', borderBottom: '2px solid #1e3a5f', fontWeight: 700 },
  content:      {},
  loading:      { textAlign: 'center', padding: 40, color: '#888' },
  sectionHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: '#6c757d' },
  card:         { background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto', marginBottom: 20 },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { padding: '10px 16px', background: '#f8f9fa', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6c757d', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e9ecef' },
  row:          { transition: 'background 0.1s' },
  td:           { padding: '10px 16px', fontSize: 13, borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' },
  name:         { fontWeight: 600, color: '#212529' },
  mono:         { fontFamily: 'monospace', fontSize: 12, color: '#495057' },
  empty:        { textAlign: 'center', padding: 32, color: '#888', fontSize: 13 },
  roleBadge:    { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' },
  badgeAzure:   { display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, background: '#dbeafe', color: '#1e40af', fontWeight: 600 },
  badgeManual:  { display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, background: '#f3e8ff', color: '#6b21a8', fontWeight: 600 },
  statusDot:    { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6 },
  toast:        { background: '#1e3a5f', color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 13 },
  select:       { padding: '4px 8px', borderRadius: 4, border: '1px solid #dee2e6', fontSize: 13, marginRight: 6 },
  btn:          { padding: '4px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer', border: '1px solid transparent' },
  btnPrimary:   { padding: '8px 18px', fontSize: 13, borderRadius: 4, cursor: 'pointer', background: '#1e3a5f', color: '#fff', border: 'none', fontWeight: 600 },
  btnSecondary: { padding: '4px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer', background: '#f8f9fa', color: '#495057', border: '1px solid #dee2e6' },
  btnDanger:    { background: '#fff5f5', color: '#c0392b', border: '1px solid #f5c6cb' },
  addForm:      { background: '#fff', borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e9ecef' },
  addFormTitle: { fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 },
  formGrid:     { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 },
  formGroup:    { display: 'flex', flexDirection: 'column', gap: 4 },
  label:        { fontSize: 12, fontWeight: 600, color: '#495057' },
  input:        { padding: '7px 10px', borderRadius: 4, border: '1px solid #dee2e6', fontSize: 13, outline: 'none' },
  settingsGrid: { padding: 24, display: 'flex', flexDirection: 'column', gap: 28 },
  settingRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 },
  settingLabel: { flex: 1 },
  settingKey:   { fontSize: 14, fontWeight: 600, color: '#212529', marginBottom: 4 },
  settingDesc:  { fontSize: 12, color: '#6c757d' },
  statsRow:     { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 },
  statCard:     { background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center' },
  statValue:    { fontSize: 32, fontWeight: 700, color: '#1e3a5f' },
  statLabel:    { fontSize: 12, color: '#6c757d', marginTop: 4 },
  warningBox:   { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 20, marginBottom: 20 },
  warningTitle: { fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 8 },
  warningBody:  { fontSize: 13, color: '#78350f', lineHeight: 1.6 },
  code:         { background: '#fef3c7', padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace', fontSize: 12 },
};
