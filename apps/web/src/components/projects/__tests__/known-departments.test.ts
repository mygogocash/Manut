import { describe, expect, it } from "vitest";

import { PROJECT_DEPARTMENT_OPTIONS } from "@/services/project.service";

// Mirrors knownDepartments() in project-form-dialog.tsx, which is module-
// private. `projects.department` is free text at the database level, so rows
// exist with labels outside the whitelist. Loading one into the form used to
// make it unsubmittable, zod rejected the value and, because it was not in the
// dropdown, the user could not untick it either.
function knownDepartments(project: {
  department?: string | null;
  departments?: string[] | null;
}): string[] {
  const raw = project.departments?.length
    ? project.departments
    : project.department
      ? [project.department]
      : [];
  const allowed = new Set<string>(PROJECT_DEPARTMENT_OPTIONS);
  return raw.filter((d) => allowed.has(d));
}

describe("knownDepartments", () => {
  it("keeps the multi-select list when every value is valid", () => {
    expect(
      knownDepartments({ departments: ["Product", "Finance", "IT"] }),
    ).toEqual(["Product", "Finance", "IT"]);
  });

  it("falls back to the scalar for rows predating the multi-select", () => {
    expect(knownDepartments({ department: "Legal", departments: [] })).toEqual([
      "Legal",
    ]);
  });

  // The bug this exists to prevent: real rows carry Engineering, Compliance
  // and Trading, none of which are in the whitelist.
  it("drops labels the picker cannot offer, so the form stays submittable", () => {
    expect(knownDepartments({ department: "Engineering" })).toEqual([]);
    expect(knownDepartments({ department: "Compliance" })).toEqual([]);
    expect(knownDepartments({ department: "Trading" })).toEqual([]);
  });

  it("keeps the valid part of a mixed list", () => {
    expect(
      knownDepartments({ departments: ["Product", "Engineering", "IT"] }),
    ).toEqual(["Product", "IT"]);
  });

  it("returns an empty list for a project with no department", () => {
    expect(knownDepartments({})).toEqual([]);
    expect(knownDepartments({ department: null, departments: [] })).toEqual([]);
  });

  it("never returns a value outside the whitelist", () => {
    const out = knownDepartments({
      departments: ["Trading", "Product", "Nonsense", "Legal"],
    });
    out.forEach((d) =>
      expect(PROJECT_DEPARTMENT_OPTIONS).toContain(d as never),
    );
  });
});
