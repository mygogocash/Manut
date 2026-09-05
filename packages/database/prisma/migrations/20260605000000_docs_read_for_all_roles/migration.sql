-- Repository (docs:read) is now a default workspace permission so
-- every signed-in user can browse the wiki, not just admins. Grants
-- `docs:read` to every existing role that doesn't already hold it.
-- Idempotent via ON CONFLICT DO NOTHING.

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "id", 'docs:read'
FROM "roles"
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
