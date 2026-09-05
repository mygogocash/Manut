import { afterEach, describe, expect, it } from "vitest";

import {
  filterExcludedLeaveRecipients,
  getExcludedLeaveRecipients,
} from "./leave-notification-exclude";

describe("leave notification exclude", () => {
  const original = process.env.LEAVE_NOTIFICATION_EXCLUDE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.LEAVE_NOTIFICATION_EXCLUDE;
    } else {
      process.env.LEAVE_NOTIFICATION_EXCLUDE = original;
    }
  });

  it("returns the list unchanged when nothing is excluded", () => {
    delete process.env.LEAVE_NOTIFICATION_EXCLUDE;
    const emails = ["hr@tbh.com", "ops@tbh.com"];
    expect(filterExcludedLeaveRecipients(emails)).toEqual(emails);
  });

  it("drops excluded addresses case-insensitively", () => {
    process.env.LEAVE_NOTIFICATION_EXCLUDE = "CEO@TBH.com";
    expect(
      filterExcludedLeaveRecipients(["ceo@tbh.com", "hr@tbh.com"]),
    ).toEqual(["hr@tbh.com"]);
  });

  it("parses comma, semicolon and newline separators with stray spaces", () => {
    process.env.LEAVE_NOTIFICATION_EXCLUDE = " a@x.com , b@x.com ;\nc@x.com ";
    expect(getExcludedLeaveRecipients()).toEqual(
      new Set(["a@x.com", "b@x.com", "c@x.com"]),
    );
  });

  it("treats an empty / whitespace env var as no exclusions", () => {
    process.env.LEAVE_NOTIFICATION_EXCLUDE = "   ";
    const emails = ["a@x.com"];
    expect(filterExcludedLeaveRecipients(emails)).toEqual(emails);
    expect(getExcludedLeaveRecipients().size).toBe(0);
  });
});
