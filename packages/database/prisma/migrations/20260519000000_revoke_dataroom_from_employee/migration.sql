-- CEO directive: only the MP / Admin role can access the Data Room.
-- Revoke `dataroom:read` from every non-Admin role (Employee originally
-- had it via the seed). Idempotent: re-running this is a no-op.

DELETE FROM "role_permissions" rp
USING "roles" r
WHERE rp."role_id" = r."id"
  AND r."name" <> 'Admin'
  AND rp."permission_code" IN (
    'dataroom:read',
    'dataroom:upload',
    'dataroom:manage'
  );
