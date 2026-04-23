-- Migration 014: RLS policies for staff expense submission
-- Staff can upload receipts and manage their own expenses only.
-- Finance/admin retain full access to all expenses.

-- ── Storage: expenses bucket ─────────────────────────────────────────────────

-- Extend INSERT to include staff
DROP POLICY IF EXISTS "expenses_storage_finance_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "expenses_storage_insert" ON storage.objects;
CREATE POLICY "expenses_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'expenses' AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('finance', 'admin', 'staff')
  );

-- Allow staff + finance/admin to SELECT (needed for signed-URL generation)
DROP POLICY IF EXISTS "expenses_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "expenses_storage_finance_admin_select" ON storage.objects;
CREATE POLICY "expenses_storage_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'expenses' AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('finance', 'admin', 'auditor', 'staff')
  );

-- DELETE: finance/admin only
DROP POLICY IF EXISTS "expenses_storage_delete" ON storage.objects;
CREATE POLICY "expenses_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'expenses' AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('finance', 'admin')
  );

-- ── expense_files ─────────────────────────────────────────────────────────────

-- INSERT: extend to staff
DROP POLICY IF EXISTS "expense_files_finance_insert" ON expense_files;
DROP POLICY IF EXISTS "expense_files_insert" ON expense_files;
CREATE POLICY "expense_files_insert"
  ON expense_files FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('finance', 'admin', 'staff')
  );

-- SELECT: staff can see their own uploaded files
DROP POLICY IF EXISTS "expense_files_staff_select" ON expense_files;
CREATE POLICY "expense_files_staff_select"
  ON expense_files FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff' AND
    uploaded_by = auth.uid()
  );

-- ── expenses table ────────────────────────────────────────────────────────────

-- INSERT: extend to staff
DROP POLICY IF EXISTS "expenses_finance_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert"
  ON expenses FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('finance', 'admin', 'staff')
  );

-- SELECT: staff see only their own submitted expenses
DROP POLICY IF EXISTS "expenses_staff_select" ON expenses;
CREATE POLICY "expenses_staff_select"
  ON expenses FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff' AND
    created_by_id = auth.uid()
  );

-- UPDATE: staff can edit their own expenses while pending_finance_review or rejected
DROP POLICY IF EXISTS "expenses_staff_update" ON expenses;
CREATE POLICY "expenses_staff_update"
  ON expenses FOR UPDATE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff' AND
    created_by_id = auth.uid() AND
    status IN ('pending_finance_review', 'rejected')
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff' AND
    created_by_id = auth.uid()
  );
