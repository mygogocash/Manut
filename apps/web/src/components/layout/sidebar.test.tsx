import { describe, expect, it } from "vitest";

import { EMPLOYEE_NAV_GROUPS, NAV_GROUPS } from "@/components/layout/sidebar";

describe("NAV_GROUPS sidebar structure", () => {
  it("includes Messaging under Workspace gated by messages:read", () => {
    const workspace = NAV_GROUPS.find((g) => g.label === "Workspace");
    expect(workspace).toBeDefined();
    const messaging = workspace!.items.find((i) => i.id === "messages");
    expect(messaging).toBeDefined();
    expect(messaging!.label).toBe("Messaging");
    expect(messaging!.href).toBe("/messages");
    expect(messaging!.permissions).toContain("messages:read");
  });

  it("includes Performance for employee-only navigation", () => {
    const personal = EMPLOYEE_NAV_GROUPS.find((g) => g.label === "Personal");
    const performance = personal?.items.find((i) => i.id === "performance");

    expect(performance).toMatchObject({
      label: "Performance",
      href: "/performance",
    });
    expect(performance?.permissions).toContain("performance:read");
  });
});
