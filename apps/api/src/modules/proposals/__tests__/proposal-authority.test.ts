import { describe, expect, it } from "vitest";

import { PROPOSAL_STATUS } from "@/modules/proposals/proposal.types";
import {
  can,
  CAPABILITY,
  ROLE_PERMISSION_MATRIX,
} from "@/modules/proposals/proposal-authority";

const EMPLOYEE = ROLE_PERMISSION_MATRIX["Employee"];
const ADMIN = ["projects:manage"];

/**
 * Deciding is no longer granted by a role, so there is no "reviewer" fixture.
 * The chain engine answers whether this person owns the pending stage, and the
 * answer arrives as `canDecideStage`. These two spell that out.
 */
const NAMED_ON_STAGE = { canDecideStage: true };
const NOT_ON_STAGE = { canDecideStage: false };

const at = (status: string, permissions: string[], extra = {}) => ({
  permissions,
  status: status as never,
  ...extra,
});
const allow = (cap: string, ctx: object) =>
  can(cap as never, ctx as never).allowed;

// ── Anyone can raise one ──
describe("proposal authority: raising and viewing", () => {
  it("lets any employee create and view", () => {
    expect(
      allow(CAPABILITY.CREATE, at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE)),
    ).toBe(true);
    expect(
      allow(CAPABILITY.VIEW, at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE)),
    ).toBe(true);
  });

  it("refuses someone holding no proposal codes at all", () => {
    expect(
      allow(CAPABILITY.CREATE, at(PROPOSAL_STATUS.PENDING_APPROVAL, [])),
    ).toBe(false);
  });
});

// ── Editing ──
describe("proposal authority: editing", () => {
  it("lets the requester correct it before any stage has decided", () => {
    expect(
      allow(
        CAPABILITY.EDIT,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, {
          isRequester: true,
          isFirstStage: true,
        }),
      ),
    ).toBe(true);
  });

  // Once a stage has decided, the version that was reviewed has to stay fixed —
  // whichever stage that was, since there is no longer a fixed number of them.
  it("stops the requester editing once a stage has decided", () => {
    expect(
      allow(
        CAPABILITY.EDIT,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, {
          isRequester: true,
          isFirstStage: false,
        }),
      ),
    ).toBe(false);
  });

  it("stops anyone else editing it, whatever they hold", () => {
    expect(
      allow(
        CAPABILITY.EDIT,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, {
          isRequester: false,
          isFirstStage: true,
        }),
      ),
    ).toBe(false);
  });

  // A finished chain has no pending decision, so `currentOrder` is null and
  // `isFirstStage` used to collapse back to true — which let the requester
  // rewrite a proposal that had already been approved or declined, with
  // neither a transition nor an audit row recording it.
  it.each([PROPOSAL_STATUS.APPROVED, PROPOSAL_STATUS.DECLINED])(
    "stops the requester editing a %s proposal even if isFirstStage says otherwise",
    (status) => {
      expect(
        allow(
          CAPABILITY.EDIT,
          at(status, EMPLOYEE, { isRequester: true, isFirstStage: true }),
        ),
      ).toBe(false);
    },
  );
});

// ── Stage decisions ──
//
// Authority here is IDENTITY: being the person the current stage names. It used
// to be two permission codes for two fixed tiers, which stopped being
// expressible once an administrator could add a third stage.
describe("proposal authority: stage decisions", () => {
  it("lets the person the current stage names decide", () => {
    expect(
      allow(
        CAPABILITY.DECIDE,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, NAMED_ON_STAGE),
      ),
    ).toBe(true);
  });

  it("refuses somebody the current stage does not name", () => {
    expect(
      allow(
        CAPABILITY.DECIDE,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, NOT_ON_STAGE),
      ),
    ).toBe(false);
  });

  // Holding every proposal code is not authority to decide. Only the chain is.
  it("refuses a holder of both old tier codes who is not on the stage", () => {
    expect(
      allow(
        CAPABILITY.DECIDE,
        at(
          PROPOSAL_STATUS.PENDING_APPROVAL,
          [
            "proposals:read",
            "proposals:create",
            "proposals:review",
            "proposals:approve",
          ],
          NOT_ON_STAGE,
        ),
      ),
    ).toBe(false);
  });

  it("still decides a proposal left on a legacy status", () => {
    for (const s of [
      PROPOSAL_STATUS.PENDING_APPROVAL,
      PROPOSAL_STATUS.PENDING_CEO_APPROVAL,
    ]) {
      expect(allow(CAPABILITY.DECIDE, at(s, EMPLOYEE, NAMED_ON_STAGE))).toBe(
        true,
      );
    }
  });

  it("admits no decision on a terminal proposal", () => {
    for (const s of [PROPOSAL_STATUS.APPROVED, PROPOSAL_STATUS.DECLINED]) {
      expect(allow(CAPABILITY.DECIDE, at(s, EMPLOYEE, NAMED_ON_STAGE))).toBe(
        false,
      );
      expect(allow(CAPABILITY.DECIDE, at(s, ADMIN, NAMED_ON_STAGE))).toBe(
        false,
      );
    }
  });
});

// ── Asking for information ──
describe("proposal authority: asking for information", () => {
  it("is held by whoever can decide at the current stage", () => {
    expect(
      allow(
        CAPABILITY.ASK_INFORMATION,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, NAMED_ON_STAGE),
      ),
    ).toBe(true);
  });

  // Asking carries the same authority as deciding, so somebody who cannot decide
  // this stage cannot ask on it either.
  it("is refused to somebody who does not own the current stage", () => {
    expect(
      allow(
        CAPABILITY.ASK_INFORMATION,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, NOT_ON_STAGE),
      ),
    ).toBe(false);
  });

  it("is refused to the requester", () => {
    expect(
      allow(
        CAPABILITY.ASK_INFORMATION,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, { isRequester: true }),
      ),
    ).toBe(false);
  });

  // Nothing left to inform once a decision is recorded.
  it("is refused on a decided proposal", () => {
    expect(
      allow(
        CAPABILITY.ASK_INFORMATION,
        at(PROPOSAL_STATUS.APPROVED, EMPLOYEE, NAMED_ON_STAGE),
      ),
    ).toBe(false);
    expect(
      allow(
        CAPABILITY.ASK_INFORMATION,
        at(PROPOSAL_STATUS.DECLINED, EMPLOYEE, NAMED_ON_STAGE),
      ),
    ).toBe(false);
  });
});

// ── Answering: identity, not permission ──
//
// This is the one capability no permission code grants. These tests exist
// because nothing else would catch a regression that let the wrong person answer
// on someone's behalf.
describe("proposal authority: answering a question", () => {
  it("is held by the person it was assigned to", () => {
    expect(
      allow(
        CAPABILITY.PROVIDE_INFORMATION,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, {
          isInformationAssignee: true,
        }),
      ),
    ).toBe(true);
  });

  it("is refused to someone who was not asked", () => {
    expect(
      allow(
        CAPABILITY.PROVIDE_INFORMATION,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, {
          isInformationAssignee: false,
        }),
      ),
    ).toBe(false);
  });

  it("is refused to the reviewer who asked it", () => {
    expect(
      allow(
        CAPABILITY.PROVIDE_INFORMATION,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, EMPLOYEE, {
          isInformationAssignee: false,
          ...NAMED_ON_STAGE,
        }),
      ),
    ).toBe(false);
  });

  // The super-grant covers permission gates, not identity. An answer recorded
  // against a name that was never asked is worse than an unanswered question.
  it("is refused even to projects:manage", () => {
    expect(
      allow(
        CAPABILITY.PROVIDE_INFORMATION,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, ADMIN, {
          isInformationAssignee: false,
        }),
      ),
    ).toBe(false);
  });

  it("works for someone holding no proposal codes, if they were asked", () => {
    expect(
      allow(
        CAPABILITY.PROVIDE_INFORMATION,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, [], {
          isInformationAssignee: true,
        }),
      ),
    ).toBe(true);
  });
});

// ── Administrative super-grant ──
describe("proposal authority: projects:manage", () => {
  // Somebody has to be able to unstick a chain whose approver has left, so the
  // module super-grant decides any stage without being named on it.
  it("decides a stage it is not named on", () => {
    expect(
      allow(
        CAPABILITY.DECIDE,
        at(PROPOSAL_STATUS.PENDING_APPROVAL, ADMIN, NOT_ON_STAGE),
      ),
    ).toBe(true);
  });

  // But it does not reopen a decided proposal.
  it("still cannot decide a terminal proposal", () => {
    expect(
      allow(
        CAPABILITY.DECIDE,
        at(PROPOSAL_STATUS.APPROVED, ADMIN, NAMED_ON_STAGE),
      ),
    ).toBe(false);
  });
});
