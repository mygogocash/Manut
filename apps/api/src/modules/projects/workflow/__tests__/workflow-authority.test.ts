import { describe, expect, it } from "vitest";

import { WORKFLOW_STATUS } from "@/modules/projects/workflow/workflow.types";
import {
  can,
  CAPABILITY,
  isProjectManager,
  ROLE_PERMISSION_MATRIX,
} from "@/modules/projects/workflow/workflow-authority";

// The five roles exactly as defined in the approved RBAC matrix.
const SALES = ROLE_PERMISSION_MATRIX["Sales & Marketing"];
const PM = ROLE_PERMISSION_MATRIX["Project Manager"];
const BH = ROLE_PERMISSION_MATRIX["Business Head"];
const PA = ROLE_PERMISSION_MATRIX["Product Admin"];
const DEV = ROLE_PERMISSION_MATRIX["Development Team"];

const at = (status: string, permissions: string[], extra = {}) => ({
  permissions,
  status: status as never,
  ...extra,
});
const allow = (cap: string, ctx: object) =>
  can(cap as never, ctx as never).allowed;

// ── Sales & Marketing ──
describe("RBAC — Sales & Marketing", () => {
  it("CAN create a request, edit the draft, comment and view history", () => {
    expect(
      allow(CAPABILITY.CREATE_REQUEST, at(WORKFLOW_STATUS.DRAFT, SALES)),
    ).toBe(true);
    expect(allow(CAPABILITY.EDIT_DRAFT, at(WORKFLOW_STATUS.DRAFT, SALES))).toBe(
      true,
    );
    expect(allow(CAPABILITY.COMMENT, at(WORKFLOW_STATUS.DRAFT, SALES))).toBe(
      true,
    );
    expect(
      allow(
        CAPABILITY.VIEW_HISTORY,
        at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, SALES),
      ),
    ).toBe(true);
    expect(
      allow(CAPABILITY.UPLOAD_ATTACHMENT, at(WORKFLOW_STATUS.DRAFT, SALES)),
    ).toBe(true);
  });

  it("CANNOT edit once submitted", () => {
    expect(
      allow(
        CAPABILITY.EDIT_DRAFT,
        at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, SALES),
      ),
    ).toBe(false);
  });

  it("CANNOT approve, reject, assign timeline or close", () => {
    expect(
      allow(
        CAPABILITY.PM_DECIDE,
        at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, SALES),
      ),
    ).toBe(false);
    expect(
      allow(
        CAPABILITY.ESCALATED_DECIDE,
        at(WORKFLOW_STATUS.PENDING_ESCALATION, SALES),
      ),
    ).toBe(false);
    expect(
      allow(CAPABILITY.ASSIGN_TIMELINE, at(WORKFLOW_STATUS.APPROVED, SALES)),
    ).toBe(false);
    expect(
      allow(CAPABILITY.MARK_COMPLETED, at(WORKFLOW_STATUS.APPROVED, SALES)),
    ).toBe(false);
    expect(allow(CAPABILITY.ARCHIVE, at(WORKFLOW_STATUS.DRAFT, SALES))).toBe(
      false,
    );
  });
});

// ── Project Manager (workflow owner) ──
describe("RBAC — Project Manager (workflow owner)", () => {
  it("is recognised as the workflow owner", () => {
    expect(isProjectManager(PM)).toBe(true);
    expect(isProjectManager(BH)).toBe(false);
    expect(isProjectManager(DEV)).toBe(false);
  });

  it("CAN decide at the PM stage, return and reopen", () => {
    expect(
      allow(CAPABILITY.PM_DECIDE, at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, PM)),
    ).toBe(true);
    expect(
      allow(
        CAPABILITY.RETURN_TO_REQUESTER,
        at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, PM),
      ),
    ).toBe(true);
    expect(allow(CAPABILITY.REOPEN, at(WORKFLOW_STATUS.REJECTED, PM))).toBe(
      true,
    );
  });

  it("retains operational authority AFTER Business Head and Product Admin approval", () => {
    for (const s of [
      WORKFLOW_STATUS.PENDING_ESCALATION,
      WORKFLOW_STATUS.APPROVED,
    ]) {
      expect(allow(CAPABILITY.EDIT_DETAILS, at(s, PM))).toBe(true);
      expect(allow(CAPABILITY.MODIFY_TIMELINE, at(s, PM))).toBe(true);
      expect(allow(CAPABILITY.REASSIGN, at(s, PM))).toBe(true);
      expect(allow(CAPABILITY.ESCALATE, at(s, PM))).toBe(true);
      expect(allow(CAPABILITY.ARCHIVE, at(s, PM))).toBe(true);
    }
  });

  it("CAN mark completed from development, and update progress at any stage", () => {
    expect(
      allow(CAPABILITY.MARK_COMPLETED, at(WORKFLOW_STATUS.APPROVED, PM)),
    ).toBe(true);
    expect(
      allow(
        CAPABILITY.UPDATE_PROGRESS,
        at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, PM),
      ),
    ).toBe(true);
    expect(
      allow(
        CAPABILITY.ASSIGN_TIMELINE,
        at(WORKFLOW_STATUS.PENDING_ESCALATION, PM),
      ),
    ).toBe(true);
  });

  it("still CANNOT stand in for Business Head or Product Admin (separation of duties)", () => {
    expect(
      allow(
        CAPABILITY.ESCALATED_DECIDE,
        at(WORKFLOW_STATUS.PENDING_ESCALATION, PM),
      ),
    ).toBe(false);
    expect(
      allow(
        CAPABILITY.ESCALATED_DECIDE,
        at(WORKFLOW_STATUS.PENDING_ESCALATION, PM),
      ),
    ).toBe(false);
  });

  it("CANNOT edit or complete a closed request", () => {
    expect(
      allow(CAPABILITY.EDIT_DETAILS, at(WORKFLOW_STATUS.COMPLETED, PM)),
    ).toBe(false);
    expect(
      allow(CAPABILITY.MARK_COMPLETED, at(WORKFLOW_STATUS.COMPLETED, PM)),
    ).toBe(false);
  });
});

// ── Escalation targets (replaced the fixed Business Head / Product Admin stages) ──
//
// Authority here is "the PM named you", not a role. These tests exist because
// that is the one place in the workflow where a permission code is NOT the
// gate — so nothing else would catch a regression that let the wrong person
// approve an escalation.
describe("RBAC — escalation target", () => {
  const escalated = (perms: string[], isTarget: boolean) =>
    at(WORKFLOW_STATUS.PENDING_ESCALATION, perms, {
      isEscalationTarget: isTarget,
    });

  it("CAN approve the escalation it was named on", () => {
    expect(allow(CAPABILITY.ESCALATED_DECIDE, escalated(BH, true))).toBe(true);
    expect(allow(CAPABILITY.ESCALATED_DECIDE, escalated(PA, true))).toBe(true);
  });

  it("CAN hand it back to the PM without deciding", () => {
    expect(allow(CAPABILITY.RETURN_TO_REQUESTER, escalated(PM, true))).toBe(
      true,
    );
  });

  it("CANNOT decide an escalation aimed at someone else", () => {
    expect(allow(CAPABILITY.ESCALATED_DECIDE, escalated(BH, false))).toBe(
      false,
    );
  });

  // The PM escalated precisely because they did not want to be the only
  // approver. Letting them sign it off anyway would make escalation cosmetic.
  it("CANNOT be satisfied by the PM's own permissions", () => {
    expect(allow(CAPABILITY.ESCALATED_DECIDE, escalated(PM, false))).toBe(
      false,
    );
  });

  it("CANNOT decide a request that was never escalated", () => {
    expect(
      allow(
        CAPABILITY.ESCALATED_DECIDE,
        at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, BH, {
          isEscalationTarget: true,
        }),
      ),
    ).toBe(false);
  });

  it("CANNOT edit details, set timelines or complete the work", () => {
    expect(allow(CAPABILITY.EDIT_DETAILS, escalated(BH, true))).toBe(false);
    expect(allow(CAPABILITY.MODIFY_TIMELINE, escalated(BH, true))).toBe(false);
    expect(
      allow(
        CAPABILITY.MARK_COMPLETED,
        at(WORKFLOW_STATUS.APPROVED, BH, {
          isEscalationTarget: true,
        }),
      ),
    ).toBe(false);
  });
});

// ── Development Team ──
describe("RBAC — Development Team", () => {
  it("CAN assign the timeline, update progress and upload deliverables in development", () => {
    const s = WORKFLOW_STATUS.APPROVED;
    expect(allow(CAPABILITY.ASSIGN_TIMELINE, at(s, DEV))).toBe(true);
    expect(allow(CAPABILITY.UPDATE_PROGRESS, at(s, DEV))).toBe(true);
    expect(allow(CAPABILITY.UPLOAD_DELIVERABLE, at(s, DEV))).toBe(true);
    expect(allow(CAPABILITY.COMMENT, at(s, DEV))).toBe(true);
  });

  it("CANNOT act before the project reaches development", () => {
    expect(
      allow(
        CAPABILITY.UPDATE_PROGRESS,
        at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, DEV),
      ),
    ).toBe(false);
    expect(
      allow(
        CAPABILITY.ASSIGN_TIMELINE,
        at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, DEV),
      ),
    ).toBe(false);
  });

  it("CANNOT approve, reject or change business information", () => {
    expect(
      allow(CAPABILITY.PM_DECIDE, at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, DEV)),
    ).toBe(false);
    expect(
      allow(
        CAPABILITY.ESCALATED_DECIDE,
        at(WORKFLOW_STATUS.PENDING_ESCALATION, DEV),
      ),
    ).toBe(false);
    expect(
      allow(CAPABILITY.EDIT_DETAILS, at(WORKFLOW_STATUS.APPROVED, DEV)),
    ).toBe(false);
    expect(
      allow(CAPABILITY.MARK_COMPLETED, at(WORKFLOW_STATUS.APPROVED, DEV)),
    ).toBe(false);
  });
});

// ── Archive is read-only for everyone, including the PM ──
describe("RBAC — archived projects", () => {
  it("blocks every mutating capability once archived", () => {
    const ctx = at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, PM, {
      isArchived: true,
    });
    expect(allow(CAPABILITY.PM_DECIDE, ctx)).toBe(false);
    expect(allow(CAPABILITY.EDIT_DETAILS, ctx)).toBe(false);
    expect(allow(CAPABILITY.MODIFY_TIMELINE, ctx)).toBe(false);
    // Reading is unaffected.
    expect(allow(CAPABILITY.VIEW_HISTORY, ctx)).toBe(true);
  });
});

// ── Administrative super-grant ──
describe("RBAC — projects:manage", () => {
  const admin = ["projects:manage"];

  it("satisfies the permission gate but still obeys stage rules", () => {
    expect(
      allow(
        CAPABILITY.PM_DECIDE,
        at(WORKFLOW_STATUS.PENDING_PM_APPROVAL, admin),
      ),
    ).toBe(true);
    expect(
      allow(CAPABILITY.PM_DECIDE, at(WORKFLOW_STATUS.APPROVED, admin)),
    ).toBe(false);
  });

  // The super-grant covers permission gates, not identity. An escalation names
  // a specific person, and an approval recorded against someone who was not
  // asked is worse than a stuck request. A stuck one already has a way out: the
  // PM returns it to themselves and escalates to someone else.
  it("does NOT let an administrator decide an escalation aimed at someone else", () => {
    expect(
      allow(
        CAPABILITY.ESCALATED_DECIDE,
        at(WORKFLOW_STATUS.PENDING_ESCALATION, admin),
      ),
    ).toBe(false);
  });

  it("can still return an escalated request so it can be re-aimed", () => {
    expect(
      allow(
        CAPABILITY.RETURN_TO_REQUESTER,
        at(WORKFLOW_STATUS.PENDING_ESCALATION, admin, {
          isEscalationTarget: true,
        }),
      ),
    ).toBe(true);
  });
});
