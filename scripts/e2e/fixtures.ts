import { randomUUID } from "node:crypto";

import type { PersonaManifest, RuntimePersona } from "./personas";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function persona(
  manifest: PersonaManifest,
  kind: RuntimePersona["kind"],
): RuntimePersona {
  const result = manifest.personas.find((candidate) => candidate.kind === kind);
  if (!result) throw new Error(`Missing ${kind} fixture persona.`);
  return result;
}

export function buildFixtureSql(manifest: PersonaManifest): string {
  const admin = persona(manifest, "admin");
  const employee = persona(manifest, "employee");
  const adminRoleId = randomUUID();
  const employeeRoleId = randomUUID();
  const leaveBalanceId = randomUUID();
  const entityId = `e2e-entity-${manifest.runId}`;
  const leaveTypeId = `e2e-annual-${manifest.runId}`;
  const year = new Date().getUTCFullYear();

  return `
BEGIN;

INSERT INTO "entities" (
  "id", "name", "code", "country", "currency", "accounting_std",
  "is_active", "created_at", "updated_at"
) VALUES (
  ${sqlString(entityId)}, 'E2E Entity', 'E2E', 'Thailand', 'THB', 'IFRS',
  TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO "users" (
  "id", "email", "name", "entity_id", "department", "job_title",
  "employee_id", "is_active", "must_change_password", "created_at", "updated_at"
) VALUES
  (${sqlString(admin.id)}::uuid, ${sqlString(admin.email)}, ${sqlString(admin.name)},
   ${sqlString(entityId)}, 'Technology', 'E2E Administrator',
   ${sqlString(`E2E-ADMIN-${manifest.runId}`)}, TRUE, FALSE,
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (${sqlString(employee.id)}::uuid, ${sqlString(employee.email)}, ${sqlString(employee.name)},
   ${sqlString(entityId)}, 'People', 'E2E Employee',
   ${sqlString(`E2E-EMPLOYEE-${manifest.runId}`)}, TRUE, FALSE,
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "roles" (
  "id", "name", "description", "is_system", "default_route",
  "created_at", "updated_at"
) VALUES
  (${sqlString(adminRoleId)}::uuid, 'Admin', 'E2E system administrator', TRUE,
   '/dashboard', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (${sqlString(employeeRoleId)}::uuid, 'Employee', 'E2E employee persona', TRUE,
   '/my-portal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "user_roles" ("user_id", "role_id", "assigned_at") VALUES
  (${sqlString(admin.id)}::uuid, ${sqlString(adminRoleId)}::uuid, CURRENT_TIMESTAMP),
  (${sqlString(employee.id)}::uuid, ${sqlString(employeeRoleId)}::uuid, CURRENT_TIMESTAMP);

INSERT INTO "role_permissions" ("role_id", "permission_code") VALUES
  (${sqlString(employeeRoleId)}::uuid, 'leave:read'),
  (${sqlString(employeeRoleId)}::uuid, 'leave:request'),
  (${sqlString(employeeRoleId)}::uuid, 'performance:read'),
  (${sqlString(employeeRoleId)}::uuid, 'performance:self-review'),
  (${sqlString(employeeRoleId)}::uuid, 'performance:goals');

INSERT INTO "leave_types" (
  "id", "entity_id", "name", "code", "category", "days_per_year",
  "requires_approval", "is_paid", "is_active"
) VALUES (
  ${sqlString(leaveTypeId)}, ${sqlString(entityId)}, 'Annual Leave', 'ANNUAL',
  'earned', 20, FALSE, TRUE, TRUE
);

INSERT INTO "leave_balances" (
  "id", "employee_id", "leave_type_id", "year", "entitled", "used",
  "carried", "carried_used", "adjustment"
) VALUES (
  ${sqlString(leaveBalanceId)}::uuid, ${sqlString(employee.id)}::uuid,
  ${sqlString(leaveTypeId)}, ${year}, 20, 0, 0, 0, 0
);

COMMIT;
`;
}
