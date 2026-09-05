-- PR #193 removed Department Management (`department:read|create|update|delete`)
-- from the typed PERMISSIONS catalog and the `/departments` page, but the
-- existing role_permission rows holding those codes were left in place.
--
-- The Roles edit dialog re-submits whatever the list endpoint returned, so
-- any role still carrying these stale codes 422s on `isValidPermissionCode`
-- validation — making the role uneditable (even for a description change).
--
-- Scrub the orphan rows. Idempotent: re-running on a clean table no-ops.

DELETE FROM role_permissions
WHERE permission_code IN (
  'department:read',
  'department:create',
  'department:update',
  'department:delete'
);
