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

  it("keeps Payroll visible when payroll:read is granted", () => {
    const links = allowedShellLinks(["payroll:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/payroll",
      "/settings",
    ]);
  });

  it("keeps Accounting visible when accounting:read is granted", () => {
    const links = allowedShellLinks(["accounting:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/accounting",
      "/settings",
    ]);
  });

  it("keeps Revenue visible when revenue:read is granted", () => {
    const links = allowedShellLinks(["revenue:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/revenue",
      "/settings",
    ]);
  });

  it("keeps Benefits visible when benefits:read is granted", () => {
    const links = allowedShellLinks(["benefits:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/benefits",
      "/settings",
    ]);
  });

  it("keeps Learning visible when learning:read is granted", () => {
    const links = allowedShellLinks(["learning:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/learning",
      "/settings",
    ]);
  });

  it("keeps Office visible when office:read is granted", () => {
    const links = allowedShellLinks(["office:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/office",
      "/settings",
    ]);
  });

  it("keeps Careers visible when career:read is granted", () => {
    const links = allowedShellLinks(["career:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/careers",
      "/settings",
    ]);
  });

  it("keeps Applications off employee-only shells even with application:read", () => {
    const links = allowedShellLinks(["application:read"], true);

    expect(links.map((link) => link.href)).toEqual(["/my-portal", "/settings"]);
  });

  it("keeps Applications visible for non-employee accounts with application:read", () => {
    const links = allowedShellLinks(["application:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/applications",
      "/settings",
    ]);
  });

  it("keeps IT Helpdesk visible when it:read is granted", () => {
    const links = allowedShellLinks(["it:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/it-helpdesk",
      "/settings",
    ]);
  });

  it("keeps Projects off employee-only shells even with projects:read", () => {
    const links = allowedShellLinks(["projects:read"], true);

    expect(links.map((link) => link.href)).toEqual(["/my-portal", "/settings"]);
  });

  it("keeps Projects visible for non-employee accounts with projects:read", () => {
    const links = allowedShellLinks(["projects:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/projects",
      "/settings",
    ]);
  });

  it("keeps Blog and PR off employee-only shells", () => {
    const links = allowedShellLinks(["blog:read", "pr:read"], true);

    expect(links.map((link) => link.href)).toEqual(["/my-portal", "/settings"]);
  });

  it("keeps Blog and PR visible for non-employee accounts", () => {
    const links = allowedShellLinks(["blog:read", "pr:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/blog-management",
      "/pr-management",
      "/settings",
    ]);
  });

  it("keeps Announcements and Docs visible for employees with read perms", () => {
    const links = allowedShellLinks(
      ["legal:announcement-read", "docs:read"],
      true,
    );

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/legal/announcements",
      "/docs",
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

