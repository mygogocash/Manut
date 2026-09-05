import { describe, expect, it } from "vitest";

import {
  createProposalSchema,
  proposalAskSchema,
  proposalDeclineSchema,
  proposalQuerySchema,
  proposalRespondSchema,
} from "@/modules/proposals/proposal.validation";

describe("createProposalSchema", () => {
  const valid = {
    title: "Wallet reconciliation",
    description: "Finance reconciles by hand every week",
  };

  it("defaults the type to idea", () => {
    expect(createProposalSchema.parse(valid).type).toBe("idea");
  });

  it("trims the title and description", () => {
    const r = createProposalSchema.parse({
      title: "  Spaced  ",
      description: "  A real description here  ",
    });
    expect(r.title).toBe("Spaced");
    expect(r.description).toBe("A real description here");
  });

  it("rejects an empty title or a thin description", () => {
    expect(() =>
      createProposalSchema.parse({ ...valid, title: "   " }),
    ).toThrow();
    expect(() =>
      createProposalSchema.parse({ ...valid, description: "no" }),
    ).toThrow();
  });

  it("rejects an unknown type", () => {
    expect(() =>
      createProposalSchema.parse({ ...valid, type: "wishlist" }),
    ).toThrow();
  });

  // Projects use cuid, not uuid. Validating as uuid would reject every real
  // project link, so this guards against that regression.
  it("accepts a cuid project id", () => {
    const r = createProposalSchema.parse({
      ...valid,
      projectId: "cmryt2wcc0000s60iis0ra10h",
    });
    expect(r.projectId).toBe("cmryt2wcc0000s60iis0ra10h");
  });

  it("accepts a null project id, meaning no link", () => {
    expect(
      createProposalSchema.parse({ ...valid, projectId: null }).projectId,
    ).toBeNull();
  });
});

describe("proposalQuerySchema", () => {
  it("defaults to the full list", () => {
    expect(proposalQuerySchema.parse({}).view).toBe("list");
  });

  it("accepts every real view", () => {
    for (const view of [
      "list",
      "mine",
      "pending",
      "answering",
      "approved",
      "declined",
    ]) {
      expect(proposalQuerySchema.parse({ view }).view).toBe(view);
    }
  });

  it("rejects an invented view rather than silently falling back", () => {
    expect(() => proposalQuerySchema.parse({ view: "everything" })).toThrow();
  });
});

describe("proposalDeclineSchema", () => {
  // A decline is the only thing the requester has to work with, so "no" on its
  // own is refused at the boundary as well as in the service.
  it("requires a reason of real substance", () => {
    expect(() => proposalDeclineSchema.parse({ reason: "no" })).toThrow();
    expect(() => proposalDeclineSchema.parse({})).toThrow();
    expect(
      proposalDeclineSchema.parse({ reason: "No budget this year" }).reason,
    ).toBe("No budget this year");
  });
});

describe("proposalAskSchema", () => {
  const someone = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  it("takes several assignees, because asking in parallel is the normal case", () => {
    const r = proposalAskSchema.parse({
      assigneeIds: [someone, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"],
      question: "Confirm the contract position",
    });
    expect(r.assigneeIds).toHaveLength(2);
  });

  it("requires at least one person", () => {
    expect(() =>
      proposalAskSchema.parse({ assigneeIds: [], question: "Anyone there?" }),
    ).toThrow();
  });

  it("caps the fan-out", () => {
    expect(() =>
      proposalAskSchema.parse({
        assigneeIds: Array.from({ length: 11 }, () => someone),
        question: "Confirm the contract position",
      }),
    ).toThrow();
  });

  it("requires the question to say something", () => {
    expect(() =>
      proposalAskSchema.parse({ assigneeIds: [someone], question: "?" }),
    ).toThrow();
  });
});

describe("proposalRespondSchema", () => {
  it("refuses an empty answer", () => {
    expect(() => proposalRespondSchema.parse({ response: "   " })).toThrow();
    expect(proposalRespondSchema.parse({ response: "Yes" }).response).toBe(
      "Yes",
    );
  });
});
