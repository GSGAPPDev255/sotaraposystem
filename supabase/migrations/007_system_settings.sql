-- Migration 007: System settings table + manual approver support

-- Allow null azure_oid so admins can add approvers not yet in Azure AD
ALTER TABLE approvers ALTER COLUMN azure_oid DROP NOT NULL;

-- System-wide configuration key/value store
CREATE TABLE system_settings (
  key          TEXT PRIMARY KEY,
  value        TEXT,
  description  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID REFERENCES profiles(id)
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings (needed for UI config)
CREATE POLICY "settings_authenticated_read" ON system_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admin can write settings
CREATE POLICY "settings_admin_write" ON system_settings
  FOR ALL USING (current_user_role() = 'admin');

-- Seed default values
INSERT INTO system_settings (key, value, description) VALUES
  ('reminder_days',      '3',  'Days after approval sent before a reminder is emailed'),
  ('alert_cc_emails',    '',   'Comma-separated emails to CC on every approval notification'),
  ('admin_alert_email',  '',   'Email address to notify when system errors occur'),
  ('finance_mailbox',    '',   'Override finance mailbox address (leave blank to use env var)'),
  ('max_reminders',      '3',  'Maximum number of reminders to send per invoice before escalating');
