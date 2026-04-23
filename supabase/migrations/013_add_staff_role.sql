-- Migration 013: Add 'staff' to user_role enum
-- Staff users can only access the expense submission portal.
-- Must run in its own migration because PostgreSQL does not allow using a
-- freshly-added enum value in the same transaction that added it.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
