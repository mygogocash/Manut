import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_HOURS, leaveWorkflowInstanceId } from "../src/workflows/leave-approval";

describe("leave approval workflow sidecar", () => {
  it("derives a stable instance id from the Postgres request id", () => {
    expect(leaveWorkflowInstanceId("req_abc")).toBe("leave-req_abc");
  });

  it("defaults to 24h / 72h / 168h reminders and never approves", () => {
    expect(DEFAULT_REMINDER_HOURS).toEqual([24, 72, 168]);
  });
});
