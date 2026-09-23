-- Accessly: user account management for everyone behind /admin. Roles are
-- assigned directly on the existing admins whitelist table rather than a
-- separate join table, since a user has exactly one role at a time — bind
-- (PUT) sets it, unbind (DELETE) clears it back to NULL, leaving the row
-- (and therefore login access) intact either way.
ALTER TABLE admins ADD COLUMN role TEXT
    CHECK (role IN ('owner', 'operations', 'accounting'));

-- Any admin seeded before Accessly existed (including the bootstrap
-- ADMIN_EMAIL account) is treated as an owner so nobody who already had
-- full access loses it silently.
UPDATE admins SET role = 'owner' WHERE role IS NULL;
