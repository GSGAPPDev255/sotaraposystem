-- Migration 004: Row Level Security policies

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_files   ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominal_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_exports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders       ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Helper function: check if current user is finance or admin
CREATE OR REPLACE FUNCTION is_finance_or_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('finance', 'admin')
  )
$$;

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Users can always read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Admins can do everything
CREATE POLICY "profiles_admin_all" ON profiles
  USING (current_user_role() = 'admin');

-- Finance/auditor can read all profiles (needed for audit trail display)
CREATE POLICY "profiles_finance_read" ON profiles
  FOR SELECT USING (current_user_role() IN ('finance', 'auditor'));

-- ── approvers ─────────────────────────────────────────────────────────────────
-- All authenticated users can read approvers (needed for assignment dropdowns)
CREATE POLICY "approvers_authenticated_read" ON approvers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admin can write approvers (sync-approvers edge function uses service role)
CREATE POLICY "approvers_admin_write" ON approvers
  FOR ALL USING (current_user_role() = 'admin');

-- ── invoice_files ─────────────────────────────────────────────────────────────
CREATE POLICY "invoice_files_finance_admin" ON invoice_files
  USING (current_user_role() IN ('finance', 'admin', 'auditor'));

CREATE POLICY "invoice_files_approver_read" ON invoice_files
  FOR SELECT USING (
    current_user_role() = 'approver' AND
    id IN (
      SELECT invoice_file_id FROM purchase_orders
      WHERE assigned_approver_id IN (
        SELECT id FROM approvers WHERE email = auth.email()
      )
      OR second_approver_id IN (
        SELECT id FROM approvers WHERE email = auth.email()
      )
    )
  );

-- ── purchase_orders ───────────────────────────────────────────────────────────
-- Finance/admin/auditor: full access to all POs
CREATE POLICY "po_finance_admin_all" ON purchase_orders
  USING (current_user_role() IN ('finance', 'admin', 'auditor'));

-- Approvers: can only see POs assigned to them
CREATE POLICY "po_approver_select" ON purchase_orders
  FOR SELECT USING (
    current_user_role() = 'approver' AND (
      assigned_approver_id IN (SELECT id FROM approvers WHERE email = auth.email()) OR
      second_approver_id   IN (SELECT id FROM approvers WHERE email = auth.email())
    )
  );

-- Approvers can update ONLY their decision fields (approved_at, approved_by_id, etc.)
-- Full update logic enforced in Edge Function; RLS allows the update if assigned
CREATE POLICY "po_approver_update" ON purchase_orders
  FOR UPDATE USING (
    current_user_role() = 'approver' AND (
      assigned_approver_id IN (SELECT id FROM approvers WHERE email = auth.email()) OR
      second_approver_id   IN (SELECT id FROM approvers WHERE email = auth.email())
    )
  );

-- ── ocr_extractions ───────────────────────────────────────────────────────────
-- Finance/admin/auditor read
CREATE POLICY "ocr_finance_read" ON ocr_extractions
  FOR SELECT USING (current_user_role() IN ('finance', 'admin', 'auditor'));

-- Approvers can read OCR for their assigned POs
CREATE POLICY "ocr_approver_read" ON ocr_extractions
  FOR SELECT USING (
    current_user_role() = 'approver' AND
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE assigned_approver_id IN (SELECT id FROM approvers WHERE email = auth.email())
      OR second_approver_id      IN (SELECT id FROM approvers WHERE email = auth.email())
    )
  );

-- No one may update or delete OCR records (enforced by trigger too)
CREATE POLICY "ocr_no_update" ON ocr_extractions FOR UPDATE USING (FALSE);
CREATE POLICY "ocr_no_delete" ON ocr_extractions FOR DELETE USING (FALSE);

-- ── nominal_lines & vat_lines ─────────────────────────────────────────────────
CREATE POLICY "nominal_finance_all" ON nominal_lines
  USING (current_user_role() IN ('finance', 'admin'));

CREATE POLICY "nominal_auditor_read" ON nominal_lines
  FOR SELECT USING (current_user_role() = 'auditor');

CREATE POLICY "nominal_approver_read" ON nominal_lines
  FOR SELECT USING (current_user_role() = 'approver');

CREATE POLICY "vat_finance_all" ON vat_lines
  USING (current_user_role() IN ('finance', 'admin'));

CREATE POLICY "vat_auditor_read" ON vat_lines
  FOR SELECT USING (current_user_role() = 'auditor');

CREATE POLICY "vat_approver_read" ON vat_lines
  FOR SELECT USING (current_user_role() = 'approver');

-- ── audit_log ─────────────────────────────────────────────────────────────────
-- Any authenticated user may insert (Edge Functions use service role for inserts)
CREATE POLICY "audit_insert_auth" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Finance/admin/auditor may read
CREATE POLICY "audit_read_finance" ON audit_log
  FOR SELECT USING (current_user_role() IN ('finance', 'admin', 'auditor'));

-- Immutability enforced via trigger; belt-and-braces RLS
CREATE POLICY "audit_no_update" ON audit_log FOR UPDATE USING (FALSE);
CREATE POLICY "audit_no_delete" ON audit_log FOR DELETE USING (FALSE);

-- ── csv_exports ───────────────────────────────────────────────────────────────
CREATE POLICY "csv_exports_read" ON csv_exports
  FOR SELECT USING (current_user_role() IN ('finance', 'admin', 'auditor'));

CREATE POLICY "csv_exports_insert" ON csv_exports
  FOR INSERT WITH CHECK (current_user_role() IN ('finance', 'admin'));

-- ── reminders ─────────────────────────────────────────────────────────────────
CREATE POLICY "reminders_finance_read" ON reminders
  FOR SELECT USING (current_user_role() IN ('finance', 'admin', 'auditor'));
