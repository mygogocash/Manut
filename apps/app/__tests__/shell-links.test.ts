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
