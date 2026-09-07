import { describe, expect, it } from "vitest";
import { sidecarTickKey } from "../src/lib/jobs";

describe("sidecar queue keys", () => {
  it("namespaces reminder, audit, and ingest jobs", () => {
    expect(sidecarTickKey("leave-approval-reminder", "req-1")).toBe("sidecar:leave-approval-reminder:req-1");
    expect(sidecarTickKey("audit-log")).toBe("sidecar:audit-log:none");
    expect(sidecarTickKey("handbook-ingest", "policy-9")).toBe("sidecar:handbook-ingest:policy-9");
  });
});
