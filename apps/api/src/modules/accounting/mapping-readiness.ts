import {
  MAPPING_ROLES,
  type MappingRole,
  REQUIRED_MAPPING_ROLES,
} from "@/modules/accounting/gl-posting.service";

// Pure helpers for the account-mapping + posting-readiness surface. Kept DB-free
// so the "which roles are mapped / is this entity ready to post" logic is
// unit-testable without a database (mirrors posting-builders.ts).

export interface MappedAccountRef {
  id: string;
  code: string;
  name: string;
  type: string;
}

// A persisted account_mappings row, as loaded from the repository.
export interface MappingRow {
  role: string;
  chartOfAccountId: string;
  account?: MappedAccountRef | null;
}

// One row per canonical role, whether or not it is currently mapped. This is
// what the config UI renders: every role always shows, mapped or blank.
export interface RoleMappingView {
  role: MappingRole;
  chartOfAccountId: string | null;
  account: MappedAccountRef | null;
}

// Project the persisted rows onto the full canonical role list, so unmapped
// roles surface explicitly instead of silently missing. Stray rows whose role
// is not a current MAPPING_ROLE are ignored (a retired role must not appear as
// "mapped").
export function buildRoleView(mapped: MappingRow[]): RoleMappingView[] {
  const byRole = new Map(mapped.map((m) => [m.role, m]));
  return MAPPING_ROLES.map((role) => {
    const row = byRole.get(role);
    return {
      role,
      chartOfAccountId: row?.chartOfAccountId ?? null,
      account: row?.account ?? null,
    };
  });
}

export interface PostingReadiness {
  entityId: string;
  // The ACCOUNTING_GL_POSTING env flag (gate 1).
  postingFlagEnabled: boolean;
  totalRoles: number;
  mappedCount: number;
  unmappedRoles: MappingRole[];
  // All canonical roles have an account (gate 2).
  mappingComplete: boolean;
  // Both gates pass — posting will actually engage for this entity.
  ready: boolean;
}

// The two-gate readiness rule: posting engages only when the flag is on AND the
// entity's mapping is complete. Roles present in `mappedRoles` that are not
// canonical roles are ignored, so a stray/retired mapping can't fake completeness.
export function computeReadiness(
  entityId: string,
  mappedRoles: string[],
  postingFlagEnabled: boolean,
): PostingReadiness {
  // Readiness gates on the REQUIRED roles only; the situational roles
  // (fx_gain/fx_loss/bank_charges/customer_advances/vendor_advances/
  // vat_output_deferred/vat_input_deferred/sales_returns/
  // settlement_writeoff/opening_balance_equity) are mappable but never block posting.
  const mappedSet = new Set(mappedRoles);
  const unmappedRoles = REQUIRED_MAPPING_ROLES.filter(
    (role) => !mappedSet.has(role),
  );
  const mappingComplete = unmappedRoles.length === 0;
  return {
    entityId,
    postingFlagEnabled,
    totalRoles: REQUIRED_MAPPING_ROLES.length,
    mappedCount: REQUIRED_MAPPING_ROLES.length - unmappedRoles.length,
    unmappedRoles: [...unmappedRoles],
    mappingComplete,
    ready: postingFlagEnabled && mappingComplete,
  };
}
