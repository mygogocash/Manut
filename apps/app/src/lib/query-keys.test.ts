import { describe, expect, it } from "vitest";
import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  it("keeps leave requests stable for TanStack Query", () => {
    expect(queryKeys.leave.requests()).toEqual(["leave", "requests"]);
    expect(queryKeys.me()).toEqual(["me"]);
    expect(queryKeys.resource("/expenses/reports")).toEqual(["resource", "/expenses/reports"]);
    expect(queryKeys.dashboard.stats()).toEqual(["dashboard", "stats"]);
  });
});
