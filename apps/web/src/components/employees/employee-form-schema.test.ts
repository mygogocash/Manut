import { describe, expect, it } from "vitest";

import {
  EMPLOYEE_FORM_DEFAULTS,
  employeeFormSchema,
} from "./employee-form-schema";

const validBase = {
  ...EMPLOYEE_FORM_DEFAULTS,
  name: "Kit Test",
  email: "kit@example.com",
  department: "Engineering",
  roleIds: ["role-1"],
};

describe("employeeFormSchema > startDate", () => {
  it("given empty startDate > parses as valid (not required)", () => {
    const result = employeeFormSchema.safeParse({
      ...validBase,
      startDate: "",
    });
    expect(result.success).toBe(true);
  });

  it("given valid startDate > parses as valid", () => {
    const result = employeeFormSchema.safeParse({
      ...validBase,
      startDate: "2026-05-05",
    });
    expect(result.success).toBe(true);
  });

  it("given missing name > still rejects (other required fields unaffected)", () => {
    const result = employeeFormSchema.safeParse({
      ...validBase,
      name: "",
      startDate: "",
    });
    expect(result.success).toBe(false);
  });
});
