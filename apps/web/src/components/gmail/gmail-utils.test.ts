import { describe, expect, it } from "vitest";

import {
  buildComposeDraft,
  buildForwardSubject,
  buildReplySubject,
  parseEmailAddress,
  parseEmailList,
} from "@/components/gmail/gmail-utils";
import type { GmailMessage } from "@/services/integrations.service";

const sampleEmail: GmailMessage = {
  messageId: "m1",
  threadId: "t1",
  rfcMessageId: "<msg@test>",
  from: "Alice <alice@example.com>",
  to: "Bob <bob@example.com>, Me <me@company.com>",
  cc: "Carol <carol@example.com>",
  subject: "Hello",
  date: "Mon, 1 Jan 2026 10:00:00 +0000",
  bodyText: "Hi",
  bodyHtml: "<p>Hi</p>",
};

describe("gmail-utils", () => {
  it("parses angle-bracket and bare addresses", () => {
    expect(parseEmailAddress('"Alice" <alice@example.com>')).toBe(
      "alice@example.com",
    );
    expect(parseEmailAddress("bob@example.com")).toBe("bob@example.com");
  });

  it("parses comma-separated lists", () => {
    expect(parseEmailList("a@x.com, B <b@y.com>")).toEqual([
      "a@x.com",
      "b@y.com",
    ]);
  });

  it("prefixes reply and forward subjects once", () => {
    expect(buildReplySubject("Hello")).toBe("Re: Hello");
    expect(buildReplySubject("Re: Hello")).toBe("Re: Hello");
    expect(buildForwardSubject("Hello")).toBe("Fwd: Hello");
  });

  it("builds reply-all excluding self", () => {
    const draft = buildComposeDraft("replyAll", sampleEmail, "me@company.com");
    expect(draft.to).toContain("alice@example.com");
    expect(draft.to).toContain("bob@example.com");
    expect(draft.to).not.toContain("me@company.com");
    expect(draft.cc).toContain("carol@example.com");
    expect(draft.inReplyTo).toBe("<msg@test>");
    expect(draft.threadId).toBe("t1");
  });
});
