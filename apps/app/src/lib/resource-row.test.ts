import { describe, expect, it } from "vitest";
import { defaultResourceRow } from "./resource-row";

describe("defaultResourceRow", () => {
  it("prefers title, then name, then id", () => {
    expect(defaultResourceRow({ id: "1", title: "Leave" }).title).toBe("Leave");
    expect(defaultResourceRow({ id: "1", name: "HRMS" }).title).toBe("HRMS");
    expect(defaultResourceRow({ id: "abc" }).title).toBe("abc");
  });

  it("joins status-like fields and keeps content as body", () => {
    const row = defaultResourceRow({
      id: "1",
      name: "Ticket",
      status: "open",
      team: "it",
      content: "Need a laptop",
    });
    expect(row.meta).toBe("open · it");
    expect(row.body).toBe("Need a laptop");
  });
});
