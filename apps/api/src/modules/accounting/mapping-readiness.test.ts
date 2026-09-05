import { describe, expect, it } from "vitest";

import {
  MAPPING_ROLES,
  REQUIRED_MAPPING_ROLES,
} from "@/modules/accounting/gl-posting.service";
import {
  buildRoleView,
  computeReadiness,
  type MappingRow,
} from "@/modules/accounting/mapping-readiness";

describe("buildRoleView", () => {
  it("returns one row per canonical role, in canonical order", () => {
    const view = buildRoleView([]);
    expect(view.map((r) => r.role)).toEqual([...MAPPING_ROLES]);
    expect(view.every((r) => r.chartOfAccountId === null)).toBe(true);
  });

  it("fills in mapped rows and leaves the rest null", () => {
    const mapped: MappingRow[] = [
      {
        role: "ar_control",
        chartOfAccountId: "acc-1",
        account: {
          id: "acc-1",
          code: "1130",
          name: "Accounts Receivable",
          type: "asset",
        },
      },
    ];
    const view = buildRoleView(mapped);
    const ar = view.find((r) => r.role === "ar_control");
    expect(ar?.chartOfAccountId).toBe("acc-1");
    expect(ar?.account?.code).toBe("1130");
    // Every other role stays unmapped.
    expect(view.filter((r) => r.chartOfAccountId !== null)).toHaveLength(1);
  });

  it("ignores stray/retired roles that are not canonical", () => {
    const mapped: MappingRow[] = [
      { role: "legacy_role_no_longer_used", chartOfAccountId: "acc-x" },
    ];
    const view = buildRoleView(mapped);
    expect(view.every((r) => r.chartOfAccountId === null)).toBe(true);
    expect(view.map((r) => r.role)).not.toContain("legacy_role_no_longer_used");
  });
});

describe("computeReadiness", () => {
  it("is not ready when nothing is mapped, regardless of the flag", () => {
    const r = computeReadiness("ent-1", [], true);
    expect(r.mappedCount).toBe(0);
    // Readiness gates on the REQUIRED roles only, not every mappable role.
    expect(r.totalRoles).toBe(REQUIRED_MAPPING_ROLES.length);
    expect(r.unmappedRoles).toEqual([...REQUIRED_MAPPING_ROLES]);
    expect(r.mappingComplete).toBe(false);
    expect(r.ready).toBe(false);
  });

  it("is ready when only the REQUIRED roles are mapped — the situational roles do not block", () => {
    const r = computeReadiness("ent-1", [...REQUIRED_MAPPING_ROLES], true);
    expect(r.mappingComplete).toBe(true);
    expect(r.ready).toBe(true);
    // The 6 situational roles (fx_gain, fx_loss, …) are unmapped here yet
    // readiness is still complete.
    expect(MAPPING_ROLES.length).toBeGreaterThan(REQUIRED_MAPPING_ROLES.length);
  });

  it("is not ready when mapping is complete but the flag is off (gate 1)", () => {
    const r = computeReadiness("ent-1", [...MAPPING_ROLES], false);
    expect(r.mappingComplete).toBe(true);
    expect(r.postingFlagEnabled).toBe(false);
    expect(r.ready).toBe(false);
  });

  it("is not ready when the flag is on but a role is missing (gate 2)", () => {
    const partial = MAPPING_ROLES.filter((role) => role !== "rounding");
    const r = computeReadiness("ent-1", [...partial], true);
    expect(r.mappingComplete).toBe(false);
    expect(r.unmappedRoles).toEqual(["rounding"]);
    expect(r.ready).toBe(false);
  });

  it("is ready only when the flag is on AND every role is mapped", () => {
    const r = computeReadiness("ent-1", [...MAPPING_ROLES], true);
    expect(r.mappingComplete).toBe(true);
    expect(r.ready).toBe(true);
  });

  it("ignores stray roles so they can't fake completeness", () => {
    const partial = MAPPING_ROLES.filter((role) => role !== "rounding");
    const r = computeReadiness("ent-1", [...partial, "bogus_role"], true);
    expect(r.mappedCount).toBe(REQUIRED_MAPPING_ROLES.length - 1);
    expect(r.unmappedRoles).toEqual(["rounding"]);
    expect(r.ready).toBe(false);
  });
});
