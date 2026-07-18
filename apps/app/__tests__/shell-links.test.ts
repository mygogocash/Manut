import { allowedShellLinks } from "@/navigation/shell-links";

describe("allowedShellLinks", () => {
  it("keeps Performance visible for an employee who has its leaf permission", () => {
    const links = allowedShellLinks(["performance:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/performance",
      "/settings",
    ]);
  });

  it("keeps Travel visible when travel:read is granted", () => {
    const links = allowedShellLinks(["travel:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/travel",
      "/settings",
    ]);
  });

  it("keeps Expenses visible when expense:read is granted", () => {
    const links = allowedShellLinks(["expense:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/expenses",
      "/settings",
    ]);
  });

  it("keeps HRMS visible when hrms:read is granted", () => {
    const links = allowedShellLinks(["hrms:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/hrms",
      "/settings",
    ]);
  });

  it("keeps Visas visible when visa:read is granted", () => {
    const links = allowedShellLinks(["visa:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/visa",
      "/settings",
    ]);
  });

  it("keeps Cash advance visible when cash-advance:read is granted", () => {
    const links = allowedShellLinks(["cash-advance:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/cash-advance",
      "/settings",
    ]);
  });

  it("keeps admin Employees and Roles off employee-only shells", () => {
    const links = allowedShellLinks(["user:read", "role:read"], true);

    expect(links.map((link) => link.href)).toEqual(["/my-portal", "/settings"]);
  });

  it("shows admin Employees and Roles for non-employee accounts", () => {
    const links = allowedShellLinks(["user:read", "role:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/employees",
      "/roles",
      "/settings",
    ]);
  });

  it("does not expose links whose route policy is unsatisfied", () => {
    const links = allowedShellLinks(["home:read", "directory:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/dashboard",
      "/my-portal",
      "/directory",
      "/settings",
    ]);
  });
});

