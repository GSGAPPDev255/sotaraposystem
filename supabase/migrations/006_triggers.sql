-- Migration 006: Triggers

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_po_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_nominal_updated_at
  BEFORE UPDATE ON nominal_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vat_updated_at
  BEFORE UPDATE ON vat_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enforce description ≤ 75 characters
CREATE OR REPLACE FUNCTION check_description_length()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.description IS NOT NULL AND char_length(NEW.description) > 75 THEN
    RAISE EXCEPTION 'Description must not exceed 75 characters (got %)', char_length(NEW.description);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_po_description_length
  BEFORE INSERT OR UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION check_description_length();

-- Auto-create profile on first Azure AD login
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, azure_oid, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'sub',
    'approver'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Prevent updates/deletes on audit_log
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log records are immutable';
END;
$$;

CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- Prevent updates on ocr_extractions
CREATE OR REPLACE FUNCTION prevent_ocr_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ocr_extractions records are immutable';
END;
$$;

CREATE TRIGGER trg_ocr_no_update
  BEFORE UPDATE ON ocr_extractions
  FOR EACH ROW EXECUTE FUNCTION prevent_ocr_mutation();

CREATE TRIGGER trg_ocr_no_delete
  BEFORE DELETE ON ocr_extractions
  FOR EACH ROW EXECUTE FUNCTION prevent_ocr_mutation();
