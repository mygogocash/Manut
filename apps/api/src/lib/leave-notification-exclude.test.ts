import { afterEach, describe, expect, it } from "vitest";

import { getTestEnv, setTestEnv } from "@/test-utils/assertions";

import {
  filterExcludedLeaveRecipients,
  getExcludedLeaveRecipients,
} from "./leave-notification-exclude";

describe("leave notification exclude", () => {
  const original = getTestEnv("LEAVE_NOTIFICATION_EXCLUDE");

  afterEach(() => {
    setTestEnv("LEAVE_NOTIFICATION_EXCLUDE", original);
  });

  it("returns the list unchanged when nothing is excluded", () => {
    setTestEnv("LEAVE_NOTIFICATION_EXCLUDE", undefined);
    const emails = ["hr@manut.com", "ops@manut.com"];
    expect(filterExcludedLeaveRecipients(emails)).toEqual(emails);
  });

  it("drops excluded addresses case-insensitively", () => {
    setTestEnv("LEAVE_NOTIFICATION_EXCLUDE", "CEO@Manut.com");
    expect(
      filterExcludedLeaveRecipients(["ceo@manut.com", "hr@manut.com"]),
    ).toEqual(["hr@manut.com"]);
  });

  it("parses comma, semicolon and newline separators with stray spaces", () => {
    setTestEnv("LEAVE_NOTIFICATION_EXCLUDE", " a@x.com , b@x.com ;\nc@x.com ");
    expect(getExcludedLeaveRecipients()).toEqual(
      new Set(["a@x.com", "b@x.com", "c@x.com"]),
    );
  });

  it("treats an empty / whitespace env var as no exclusions", () => {
    setTestEnv("LEAVE_NOTIFICATION_EXCLUDE", "   ");
    const emails = ["a@x.com"];
    expect(filterExcludedLeaveRecipients(emails)).toEqual(emails);
    expect(getExcludedLeaveRecipients().size).toBe(0);
  });
});
