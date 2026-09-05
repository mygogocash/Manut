import { describe, expect, it } from "vitest";

import {
  NOTIFY_ENABLED_MODULES,
  notifyModuleForTeam,
  SHARED_PROJECT_REMINDER_TEAMS,
  TASK_REMINDER_TEAMS,
} from "@/modules/crm-shared/crm-modules";

// Locks the per-phase rollout gates so a CRM can't be silently turned on/off.
// Update these expectations deliberately when a phase enables a new CRM.
describe("crm-modules rollout gates", () => {
  it("enables notifications for it/general/hr (Phase B) + legal/accounting (pt1) + product/qa (pt3)", () => {
    expect([...NOTIFY_ENABLED_MODULES].sort()).toEqual(
      ["accounting", "general", "hr", "it", "legal", "product", "qa"].sort(),
    );
  });

  it("does NOT yet enable marketing, and never the reminder-only sales CRM", () => {
    // "revenue" stays in this list as a string even though the CrmModule
    // union no longer carries it — the retired ARIA Revenue CRM must never
    // sneak back into the notify set under its old name.
    for (const m of ["marketing", "sales", "revenue"]) {
      expect(NOTIFY_ENABLED_MODULES).not.toContain(m);
    }
  });

  it("scans shared project_tasks for it/general/hr/legal/accounting/product task reminders (qa is native)", () => {
    expect([...TASK_REMINDER_TEAMS].sort()).toEqual(
      ["accounting", "general", "hr", "it", "legal", "product"].sort(),
    );
  });

  it("only scans the shared projects table for general/hr go-lives (native-mirror CRMs use a native scan)", () => {
    expect([...SHARED_PROJECT_REMINDER_TEAMS].sort()).toEqual([
      "general",
      "hr",
    ]);
  });

  it("notifyModuleForTeam resolves enabled teams and rejects disabled/unknown ones", () => {
    expect(notifyModuleForTeam("legal")).toBe("legal");
    expect(notifyModuleForTeam("accounting")).toBe("accounting");
    expect(notifyModuleForTeam("it")).toBe("it");
    // Phase C pt3 — product is a native-mirror board worked on the shared
    // /projects board, so the shared-board gate now resolves it.
    expect(notifyModuleForTeam("product")).toBe("product");
    // Unknown / no team.
    expect(notifyModuleForTeam("marketing")).toBeNull();
    expect(notifyModuleForTeam(null)).toBeNull();
    expect(notifyModuleForTeam(undefined)).toBeNull();
    expect(notifyModuleForTeam("nonsense")).toBeNull();
  });
});
