import { describe, expect, it } from "vitest";

import {
  projectApprovalRequestEmail,
  projectWorkflowDecisionEmail,
  proposalActionEmail,
  proposalUpdateEmail,
} from "@/infrastructure/email/templates";

// The email provider renders its OWN registered template from `variables` alone:
// `deliverEmail` posts { templateId, to, variables } and never forwards the
// locally-built `html`. So anything a caller can vary — a button label, a
// conditional block, an outcome-dependent row label — is invisible to the
// recipient unless it also appears in `variables`. These templates all shipped
// with values interpolated into `html` but missing from `variables`, which
// rendered remotely as an empty or wrong label with no error anywhere.
//
// Guard the invariant directly: caller-supplied text must be recoverable from
// `variables`, not merely present in `html`.

const variableText = (variables: Record<string, unknown>): string =>
  Object.values(variables)
    .filter((v): v is string => typeof v === "string")
    .join("\n");

describe("projectApprovalRequestEmail", () => {
  const base = {
    approverName: "Dana",
    projectName: "Billing engine v2",
    requesterName: "Sam",
    priority: "High",
    status: "Pending Approval",
    comment: null,
    deepLink: "https://intranet.example/projects/p1",
  };

  it("exposes the one-click actions block through variables", () => {
    const mail = projectApprovalRequestEmail({
      ...base,
      approveLink:
        "https://api.example/api/project-workflow/email-action?token=t",
      rejectLink: base.deepLink,
    });

    expect(mail.variables.actionsHtml).toContain(
      "https://api.example/api/project-workflow/email-action?token=t",
    );
    expect(mail.variables.actionsHtml).toContain("Approve");
    expect(mail.variables.actionsHtml).toContain("Reject");
  });

  it("falls back to a plain review button when action links are disabled", () => {
    const mail = projectApprovalRequestEmail({ ...base, approveLink: null });

    expect(mail.variables.actionsHtml).toContain("Review Request");
    expect(mail.variables.actionsHtml).not.toContain("email-action?token=");
  });

  it("sends an em-dash rather than a blank cell for an absent comment", () => {
    expect(projectApprovalRequestEmail(base).variables.comment).toBe("—");
    expect(
      projectApprovalRequestEmail({ ...base, comment: "   " }).variables
        .comment,
    ).toBe("—");
  });
});

describe("projectWorkflowDecisionEmail", () => {
  const base = {
    recipientName: "Sam",
    projectName: "Billing engine v2",
    requesterName: "Sam",
    priority: "High",
    status: "Completed",
    decidedBy: "Dana",
    comment: "Looks good",
    deepLink: "https://intranet.example/projects/p1",
  };

  it("resolves the outcome-dependent row labels for an approval", () => {
    const mail = projectWorkflowDecisionEmail({ ...base, approved: true });

    expect(mail.variables.decidedByLabel).toBe("Approved by");
    expect(mail.variables.commentLabel).toBe("Comments");
  });

  it("resolves the outcome-dependent row labels for a rejection", () => {
    const mail = projectWorkflowDecisionEmail({
      ...base,
      approved: false,
      status: "Rejected",
    });

    expect(mail.variables.decidedByLabel).toBe("Rejected by");
    expect(mail.variables.commentLabel).toBe("Reason");
  });
});

describe("proposalActionEmail", () => {
  const base = {
    recipientName: "Dana",
    headline: "Information needed on a proposal",
    proposalTitle: "Partner self-service portal",
    proposalType: "Feature",
    raisedBy: "Sam",
    priority: "Medium",
    status: "Awaiting information",
    deepLink: "https://intranet.example/proposals/x1",
  };

  it("carries the per-path button label", () => {
    for (const callToAction of [
      "Review Proposal",
      "Provide Information",
      "View Proposal",
    ]) {
      const mail = proposalActionEmail({ ...base, callToAction });
      expect(mail.variables.callToAction).toBe(callToAction);
      expect(variableText(mail.variables)).toContain(callToAction);
    }
  });

  it("renders the question block only when a question was asked", () => {
    const asked = proposalActionEmail({
      ...base,
      callToAction: "Provide Information",
      question: "Which telcos are in scope?",
    });
    expect(asked.variables.questionBlockHtml).toContain(
      "Which telcos are in scope?",
    );
    expect(asked.variables.questionBlockHtml).toContain("What is being asked");

    const notAsked = proposalActionEmail({
      ...base,
      callToAction: "Review Proposal",
    });
    // Empty, so the remote render cannot show a heading above an empty quote.
    expect(notAsked.variables.questionBlockHtml).toBe("");
  });

  it("escapes free text before it leaves the API", () => {
    const mail = proposalActionEmail({
      ...base,
      callToAction: "Provide Information",
      question: "<script>alert(1)</script>",
    });

    expect(mail.variables.questionBlockHtml).not.toContain("<script>");
    expect(mail.variables.questionBlockHtml).toContain("&lt;script&gt;");
  });
});

describe("proposalUpdateEmail", () => {
  const base = {
    recipientName: "Sam",
    headline: "Proposal declined",
    proposalTitle: "Partner self-service portal",
    status: "Declined",
    actedBy: "Dana",
    deepLink: "https://intranet.example/proposals/x1",
  };

  it("keeps the caller's detail heading", () => {
    for (const [detailLabel, detail] of [
      ["Answer", "Thailand and Vietnam"],
      ["Reason", "Out of scope this quarter"],
      ["Notes", "Approved with conditions"],
    ]) {
      const mail = proposalUpdateEmail({ ...base, detailLabel, detail });
      expect(mail.variables.detailBlockHtml).toContain(detailLabel);
      expect(mail.variables.detailBlockHtml).toContain(detail);
    }
  });

  it("omits the detail block when there is nothing to show", () => {
    expect(
      proposalUpdateEmail({ ...base, detail: null }).variables.detailBlockHtml,
    ).toBe("");
    expect(
      proposalUpdateEmail({ ...base, detail: "  " }).variables.detailBlockHtml,
    ).toBe("");
  });

  it("defaults the heading when the caller omits a label", () => {
    const mail = proposalUpdateEmail({ ...base, detail: "Some note" });
    expect(mail.variables.detailBlockHtml).toContain("Notes");
  });
});
