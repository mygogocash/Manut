import { describe, expect, it } from "vitest";

import { isWorkflowTeam } from "@/modules/projects/projects.service";

// `POST /api/projects` is shared: the Project CRM and every other shared-board
// CRM (HR, Legal, Accounting, QA, Product) create through it. Only the Project
// CRM runs the approval workflow.
//
// Without this gate, `create()` auto-submitted EVERY new project into the
// workflow and `assertWorkStarted` then refused addTask / updateTask /
// reorderTasks / deleteTask — so an HR record, on a module that never had
// approvals, came out with a frozen task board.
describe("isWorkflowTeam", () => {
  it("gates the Project CRM", () => {
    expect(isWorkflowTeam("general")).toBe(true);
  });

  it.each(["hr", "legal", "accounting", "qa", "product", "it"])(
    "leaves the %s board ungated",
    (team) => {
      expect(isWorkflowTeam(team)).toBe(false);
    },
  );

  it("treats a missing team as ungated", () => {
    expect(isWorkflowTeam(undefined)).toBe(false);
    expect(isWorkflowTeam(null)).toBe(false);
  });
});
