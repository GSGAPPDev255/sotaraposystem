-- Migration 005: Performance indexes

CREATE INDEX idx_po_status     ON purchase_orders(status);
CREATE INDEX idx_po_assigned   ON purchase_orders(assigned_approver_id);
CREATE INDEX idx_po_created    ON purchase_orders(created_at DESC);
CREATE INDEX idx_po_file       ON purchase_orders(invoice_file_id);
CREATE INDEX idx_po_updated    ON purchase_orders(updated_at DESC);

CREATE INDEX idx_audit_po      ON audit_log(purchase_order_id, created_at DESC);
CREATE INDEX idx_audit_actor   ON audit_log(actor_id);
CREATE INDEX idx_audit_action  ON audit_log(action);

CREATE INDEX idx_ocr_po        ON ocr_extractions(purchase_order_id);
CREATE INDEX idx_nominal_po    ON nominal_lines(purchase_order_id);
CREATE INDEX idx_vat_po        ON vat_lines(purchase_order_id);
CREATE INDEX idx_reminders_po  ON reminders(purchase_order_id);
CREATE INDEX idx_approvers_email ON approvers(email);
CREATE INDEX idx_profiles_email  ON profiles(email);
CREATE INDEX idx_profiles_azure  ON profiles(azure_oid);
