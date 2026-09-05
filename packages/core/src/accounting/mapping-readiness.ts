import {
  MAPPING_ROLES,
  type MappingRole,
  REQUIRED_MAPPING_ROLES,
} from "@nexora/contracts/modules/accounting/gl-posting.constants";

export interface MappedAccountRef {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface MappingRow {
  role: string;
  chartOfAccountId: string;
  account?: MappedAccountRef | null;
}

export interface RoleMappingView {
  role: MappingRole;
  chartOfAccountId: string | null;
  account: MappedAccountRef | null;
}

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
  postingFlagEnabled: boolean;
  totalRoles: number;
  mappedCount: number;
  unmappedRoles: MappingRole[];
  mappingComplete: boolean;
  ready: boolean;
}

export function computeReadiness(
  entityId: string,
  mappedRoles: string[],
  postingFlagEnabled: boolean,
): PostingReadiness {
  const mappedSet = new Set(mappedRoles);
  const unmappedRoles = REQUIRED_MAPPING_ROLES.filter((role) => !mappedSet.has(role));
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
