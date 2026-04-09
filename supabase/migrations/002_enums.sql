-- Migration 002: Custom enum types

CREATE TYPE invoice_status AS ENUM (
  'pending_finance_review',
  'pending_approval',
  'approved',
  'rejected',
  'approved_ready_export',
  'exported'
);

CREATE TYPE audit_action AS ENUM (
  'created',
  'ocr_completed',
  'finance_edited',
  'status_changed',
  'approval_sent',
  'approved',
  'rejected',
  'forwarded',
  'reminder_sent',
  'csv_generated',
  'exported'
);

CREATE TYPE user_role AS ENUM ('finance', 'approver', 'auditor', 'admin');
