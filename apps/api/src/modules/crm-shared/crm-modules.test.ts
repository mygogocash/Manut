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
  it("enables notifications for it/general/hr (Phase B) + legal/accounting (Phase C pt1)", () => {
    expect([...NOTIFY_ENABLED_MODULES].sort()).toEqual(
      ["accounting", "general", "hr", "it", "legal"].sort(),
    );
  });

  it("does NOT yet enable the pure-native CRMs (product/qa/marketing)", () => {
    for (const m of ["product", "qa", "marketing"]) {
      expect(NOTIFY_ENABLED_MODULES).not.toContain(m);
    }
  });

  it("scans shared project_tasks for it/general/hr/legal/accounting task reminders", () => {
    expect([...TASK_REMINDER_TEAMS].sort()).toEqual(
      ["accounting", "general", "hr", "it", "legal"].sort(),
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
    // Not yet enabled → gate returns null so the notifier no-ops.
    expect(notifyModuleForTeam("product")).toBeNull();
    // Unknown / no team.
    expect(notifyModuleForTeam("marketing")).toBeNull();
    expect(notifyModuleForTeam(null)).toBeNull();
    expect(notifyModuleForTeam(undefined)).toBeNull();
    expect(notifyModuleForTeam("nonsense")).toBeNull();
  });
});
