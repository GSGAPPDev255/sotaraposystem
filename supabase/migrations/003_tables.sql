-- Migration 003: Core tables

-- User profiles linked to Azure AD via Supabase Auth
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  azure_oid     TEXT UNIQUE,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'approver',
  user_number   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approvers synced from Azure AD (may not yet have a Supabase account)
CREATE TABLE approvers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  azure_oid     TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  department    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoice files stored in Supabase Storage
CREATE TABLE invoice_files (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_path     TEXT NOT NULL,
  bucket_name      TEXT NOT NULL DEFAULT 'invoices',
  original_name    TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  file_size_bytes  BIGINT,
  email_from       TEXT,
  email_date       TIMESTAMPTZ,
  email_subject    TEXT,
  uploaded_by      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Main Purchase Order record (finance-editable fields)
CREATE TABLE purchase_orders (
  id                                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_file_id                   UUID REFERENCES invoice_files(id),
  status                            invoice_status NOT NULL DEFAULT 'pending_finance_review',

  -- Supplier
  account_number                    TEXT,
  supplier_name                     TEXT,
  supplier_ref                      TEXT,
  supplier_ref_code                 TEXT,

  -- Invoice identifiers
  transaction_reference             TEXT,
  second_reference                  TEXT,
  unique_reference_number           TEXT,

  -- Dates
  transaction_date                  DATE,
  posting_date                      DATE,
  due_date                          DATE,

  -- Description capped at 75 chars
  description                       TEXT,

  -- Amounts
  net_amount                        NUMERIC(15,2),
  vat_amount                        NUMERIC(15,2),
  gross_amount                      NUMERIC(15,2),

  -- Sage system fields
  source                            INTEGER NOT NULL DEFAULT 2,
  sys_trader_tran_type              INTEGER NOT NULL DEFAULT 4,
  query_code                        TEXT,
  sys_trader_generation_reason_type TEXT,
  document_to_base_currency_rate    NUMERIC(15,6) DEFAULT 1,
  document_to_account_currency_rate NUMERIC(15,6) DEFAULT 1,

  -- Finance assignment
  assigned_approver_id              UUID REFERENCES approvers(id),
  second_approver_id                UUID REFERENCES approvers(id),
  finance_notes                     TEXT,
  finance_user_id                   UUID REFERENCES profiles(id),

  -- Approval outcome
  approved_by_id                    UUID REFERENCES profiles(id),
  approved_at                       TIMESTAMPTZ,
  rejected_reason                   TEXT,
  forwarded_to_id                   UUID REFERENCES approvers(id),
  forwarded_reason                  TEXT,

  -- Approval email tracking
  approval_sent_at                  TIMESTAMPTZ,
  approver_comments                 TEXT,

  -- Export tracking
  exported_at                       TIMESTAMPTZ,
  exported_by_id                    UUID REFERENCES profiles(id),
  csv_export_id                     UUID,

  -- Audit timestamps
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_id                     UUID REFERENCES profiles(id),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_id                     UUID REFERENCES profiles(id)
);

-- Raw Gemini extraction results — IMMUTABLE
CREATE TABLE ocr_extractions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  invoice_file_id   UUID NOT NULL REFERENCES invoice_files(id),
  gemini_model      TEXT NOT NULL,
  raw_response      JSONB NOT NULL,
  extracted_fields  JSONB NOT NULL,
  confidence_scores JSONB,
  processing_ms     INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nominal ledger analysis lines (max 2 per PO)
CREATE TABLE nominal_lines (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id          UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number                SMALLINT NOT NULL CHECK (line_number IN (1, 2)),
  transaction_value          NUMERIC(15,2),
  nominal_account_number     TEXT,
  nominal_cost_centre        TEXT,
  nominal_department         TEXT,
  transaction_analysis_code  TEXT,
  nominal_analysis_narrative TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (purchase_order_id, line_number)
);

-- VAT analysis lines (max 2 per PO)
CREATE TABLE vat_lines (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id             UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number                   SMALLINT NOT NULL CHECK (line_number IN (1, 2)),
  tax_rate                      NUMERIC(5,2),
  goods_value_before_discount   NUMERIC(15,2),
  tax_on_goods_value            NUMERIC(15,2),
  vat_code                      TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (purchase_order_id, line_number)
);

-- Immutable audit log — insert only
CREATE TABLE audit_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  action            audit_action NOT NULL,
  actor_id          UUID REFERENCES profiles(id),
  actor_email       TEXT,
  actor_display     TEXT,
  old_values        JSONB,
  new_values        JSONB,
  metadata          JSONB,
  ip_address        INET,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CSV export records
CREATE TABLE csv_exports (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_path       TEXT NOT NULL,
  bucket_name        TEXT NOT NULL DEFAULT 'csv-exports',
  record_count       INTEGER NOT NULL,
  validation_summary JSONB NOT NULL,
  generated_by_id    UUID REFERENCES profiles(id),
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from purchase_orders to csv_exports
ALTER TABLE purchase_orders
  ADD CONSTRAINT fk_po_csv_export
  FOREIGN KEY (csv_export_id) REFERENCES csv_exports(id);

-- Reminder tracking
CREATE TABLE reminders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_to_email     TEXT NOT NULL,
  reminder_number   INTEGER NOT NULL DEFAULT 1
);
