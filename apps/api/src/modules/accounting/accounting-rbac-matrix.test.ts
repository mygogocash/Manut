import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// The 6-role accounting matrix + the non-breaking read-all grant are seeded by
// this hand-authored migration. It is the source of truth for the DB grants, so
// we regression-guard its content directly: the safety-critical rule is that NO
// current `accounting:read` holder is silently downgraded to own-documents-only
// once scoping lands.
const MIGRATION_SQL = readFileSync(
  resolve(
    __dirname,
    "../../../../../packages/database/prisma/migrations/20261206000000_accounting_rbac_matrix/migration.sql",
  ),
  "utf8",
);

describe("accounting RBAC matrix migration (non-breaking grant)", () => {
  it("adds the own-document author column", () => {
    expect(MIGRATION_SQL).toMatch(
      /ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "created_by" UUID/,
    );
  });

  it("grants accounting:read-all to every current accounting:read holder", () => {
    // The generic grant selects the role of every accounting:read holder and
    // grants read-all — this is the regression guard for the non-breaking rule.
    expect(MIGRATION_SQL).toMatch(/'accounting:read-all'/);
    expect(MIGRATION_SQL).toMatch(
      /WHERE rp\.permission_code = 'accounting:read'/,
    );
    expect(MIGRATION_SQL).toMatch(/ON CONFLICT .* DO NOTHING/);
  });

  it("excludes the scoped Sales/Purchasing roles from the read-all sweep", () => {
    // Even after Sales/Purchasing hold accounting:read, a re-run must never
    // widen them to read-all.
    expect(MIGRATION_SQL).toMatch(
      /NOT IN \('Accounting Sales', 'Accounting Purchasing'\)/,
    );
  });

  it("seeds the four new matrix roles", () => {
    for (const role of [
      "Accounting Owner",
      "Accounting Chief",
      "Accounting Sales",
      "Accounting Purchasing",
    ]) {
      expect(MIGRATION_SQL).toContain(`'${role}'`);
    }
  });

  it("gives Owner admin but denies it to Chief/Sales/Purchasing", () => {
    // Owner block includes admin.
    const ownerBlock = sliceRoleGrant(MIGRATION_SQL, "Accounting Owner");
    expect(ownerBlock).toContain("'accounting:admin'");
    expect(ownerBlock).toContain("'accounting:read-all'");

    // Chief: read-all + approve + post, but NOT admin and NOT create.
    const chiefBlock = sliceRoleGrant(MIGRATION_SQL, "Accounting Chief");
    expect(chiefBlock).toContain("'accounting:read-all'");
    expect(chiefBlock).toContain("'accounting:approve'");
    expect(chiefBlock).toContain("'accounting:post'");
    expect(chiefBlock).not.toContain("'accounting:admin'");
    expect(chiefBlock).not.toContain("'accounting:create'");
  });

  it("scopes Sales/Purchasing to read+create only (no read-all)", () => {
    for (const role of ["Accounting Sales", "Accounting Purchasing"]) {
      const block = sliceRoleGrant(MIGRATION_SQL, role);
      expect(block).toContain("'accounting:read'");
      expect(block).toContain("'accounting:create'");
      expect(block).not.toContain("'accounting:read-all'");
      expect(block).not.toContain("'accounting:admin'");
    }
  });
});

// Extract the permission grant statement for a given role name (from the role
// name up to the terminating ON CONFLICT clause) so per-role assertions don't
// leak across statements.
function sliceRoleGrant(sql: string, roleName: string): string {
  const marker = `WHERE r.name = '${roleName}'`;
  const start = sql.indexOf(marker);
  if (start === -1) throw new Error(`grant block for ${roleName} not found`);
  const end = sql.indexOf("ON CONFLICT", start);
  return sql.slice(sql.lastIndexOf("INSERT", start), end);
}
