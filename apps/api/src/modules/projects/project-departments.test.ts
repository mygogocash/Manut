import { describe, expect, it } from "vitest";

import { departmentWrite } from "@/modules/projects/projects.service";

// A project can span several departments, but ONE stays in the scalar
// `department` column because the dashboard groups on it and a scalar list
// cannot be grouped. These tests pin that invariant: whatever a caller sends,
// `department` always equals `departments[0]` (or null when the list is empty).

const invariantHolds = (r: {
  department?: string | null;
  departments?: string[];
}) => {
  if (r.departments === undefined) return true;
  return r.department === (r.departments[0] ?? null);
};

describe("departmentWrite", () => {
  it("makes the first selected department the primary one", () => {
    const r = departmentWrite({ departments: ["Product", "IT", "Legal"] });
    expect(r.departments).toEqual(["Product", "IT", "Legal"]);
    expect(r.department).toBe("Product");
    expect(invariantHolds(r)).toBe(true);
  });

  it("mirrors a lone scalar into the list, so old clients still work", () => {
    const r = departmentWrite({ department: "Marketing" });
    expect(r.department).toBe("Marketing");
    expect(r.departments).toEqual(["Marketing"]);
    expect(invariantHolds(r)).toBe(true);
  });

  it("clears both when the scalar is nulled", () => {
    const r = departmentWrite({ department: null });
    expect(r.department).toBeNull();
    expect(r.departments).toEqual([]);
    expect(invariantHolds(r)).toBe(true);
  });

  it("clears the primary when the list is emptied", () => {
    const r = departmentWrite({ departments: [] });
    expect(r.departments).toEqual([]);
    expect(r.department).toBeNull();
    expect(invariantHolds(r)).toBe(true);
  });

  it("de-duplicates while keeping the picked order", () => {
    const r = departmentWrite({
      departments: ["IT", "Product", "IT", "Product", "Legal"],
    });
    expect(r.departments).toEqual(["IT", "Product", "Legal"]);
    expect(r.department).toBe("IT");
  });

  it("lets the list win when both are sent and they disagree", () => {
    // The form submits the list; a stale scalar must not override it.
    const r = departmentWrite({
      department: "Finance",
      departments: ["HR", "Legal"],
    });
    expect(r.department).toBe("HR");
    expect(r.departments).toEqual(["HR", "Legal"]);
    expect(invariantHolds(r)).toBe(true);
  });

  it("touches nothing when neither field is sent", () => {
    // An unrelated PATCH must not wipe a project's departments.
    expect(departmentWrite({})).toEqual({});
  });
});
