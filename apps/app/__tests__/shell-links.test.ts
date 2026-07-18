import { allowedShellLinks } from "@/navigation/shell-links";

describe("allowedShellLinks", () => {
  it("keeps Performance visible for an employee who has its leaf permission", () => {
    const links = allowedShellLinks(["performance:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/performance",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Travel visible when travel:read is granted", () => {
    const links = allowedShellLinks(["travel:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/travel",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Expenses visible when expense:read is granted", () => {
    const links = allowedShellLinks(["expense:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/expenses",
      "/files",
      "/settings",
    ]);
  });

  it("keeps HRMS visible when hrms:read is granted", () => {
    const links = allowedShellLinks(["hrms:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/hrms",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Visas visible when visa:read is granted", () => {
    const links = allowedShellLinks(["visa:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/visa",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Cash advance visible when cash-advance:read is granted", () => {
    const links = allowedShellLinks(["cash-advance:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/cash-advance",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Payroll visible when payroll:read is granted", () => {
    const links = allowedShellLinks(["payroll:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/payroll",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Accounting visible when accounting:read is granted", () => {
    const links = allowedShellLinks(["accounting:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/accounting",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Revenue visible when revenue:read is granted", () => {
    const links = allowedShellLinks(["revenue:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/revenue",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Sales off employee-only shells even with crm:read", () => {
    const links = allowedShellLinks(["crm:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Sales visible for non-employee accounts with crm:read", () => {
    const links = allowedShellLinks(["crm:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/sales",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Partners off employee-only shells even with partners:read", () => {
    const links = allowedShellLinks(["partners:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Partners visible for non-employee accounts with partners:read", () => {
    const links = allowedShellLinks(["partners:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/partners",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Benefits visible when benefits:read is granted", () => {
    const links = allowedShellLinks(["benefits:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/benefits",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Learning visible when learning:read is granted", () => {
    const links = allowedShellLinks(["learning:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/learning",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Office visible when office:read is granted", () => {
    const links = allowedShellLinks(["office:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/office",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Careers visible when career:read is granted", () => {
    const links = allowedShellLinks(["career:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/careers",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Applications off employee-only shells even with application:read", () => {
    const links = allowedShellLinks(["application:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Applications visible for non-employee accounts with application:read", () => {
    const links = allowedShellLinks(["application:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/applications",
      "/files",
      "/settings",
    ]);
  });

  it("keeps IT Helpdesk visible when it:read is granted", () => {
    const links = allowedShellLinks(["it:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/it-helpdesk",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Projects off employee-only shells even with projects:read", () => {
    const links = allowedShellLinks(["projects:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/files",
      "/settings",
    ]);
  });

  it("keeps Projects visible for non-employee accounts with projects:read", () => {
    const links = allowedShellLinks(["projects:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/projects",
      "/it-crm",
      "/product-crm",
      "/legal-crm",
      "/accounting-crm",
      "/files",
      "/settings",
    ]);
  });

  it("keeps CRM workspace hubs off employee-only shells", () => {
    const links = allowedShellLinks(
      ["it-crm:read", "product-crm:read", "qa-crm:read", "voucher-crm:read"],
      true,
    );

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/files",
      "/settings",
    ]);
  });

  it("keeps CRM workspace hubs visible for non-employee accounts", () => {
    const links = allowedShellLinks(
      [
        "it-crm:read",
        "product-crm:read",
        "legal-crm:read",
        "accounting-crm:read",
        "qa-crm:read",
        "voucher-crm:read",
      ],
      false,
    );

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/projects",
      "/it-crm",
      "/product-crm",
      "/legal-crm",
      "/accounting-crm",
      "/qa-crm",
      "/voucher-crm",
      "/files",
      "/settings",
    ]);
  });

  it("keeps admin Employees and Roles off employee-only shells", () => {
    const links = allowedShellLinks(["user:read", "role:read"], true);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/files",
      "/settings",
    ]);
  });

  it("shows admin Employees and Roles for non-employee accounts", () => {
    const links = allowedShellLinks(["user:read", "role:read"], false);

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/files",
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
      "/files",
      "/settings",
    ]);
  });

  it("keeps Drive and Messages visible with their leaf permissions", () => {
    const links = allowedShellLinks(
      ["integrations:use", "messages:read"],
      true,
    );

    expect(links.map((link) => link.href)).toEqual([
      "/my-portal",
      "/files",
      "/drive",
      "/messages",
      "/settings",
    ]);
  });

});

