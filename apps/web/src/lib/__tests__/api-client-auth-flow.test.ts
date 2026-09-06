import { describe, expect, it } from "vitest";

import { isOnAuthFlowPage } from "@/lib/api-client";

describe("isOnAuthFlowPage", () => {
  it("exempts the exact root marketing page '/' so 401s do not redirect signed-out visitors", () => {
    expect(isOnAuthFlowPage("/")).toBe(true);
  });

  it("exempts auth flow pages and their subroutes", () => {
    expect(isOnAuthFlowPage("/sign-in")).toBe(true);
    expect(isOnAuthFlowPage("/sign-in/callback")).toBe(true);
    expect(isOnAuthFlowPage("/welcome")).toBe(true);
    expect(isOnAuthFlowPage("/auth/callback")).toBe(true);
    expect(isOnAuthFlowPage("/magic-link")).toBe(true);
    expect(isOnAuthFlowPage("/forgot-password")).toBe(true);
    expect(isOnAuthFlowPage("/reset-password")).toBe(true);
  });

  it("does NOT exempt protected application routes", () => {
    expect(isOnAuthFlowPage("/dashboard")).toBe(false);
    expect(isOnAuthFlowPage("/my-portal")).toBe(false);
    expect(isOnAuthFlowPage("/employees")).toBe(false);
    expect(isOnAuthFlowPage("/hrms")).toBe(false);
    expect(isOnAuthFlowPage("/leave")).toBe(false);
    expect(isOnAuthFlowPage("/expenses")).toBe(false);
    expect(isOnAuthFlowPage("/accounting")).toBe(false);
    expect(isOnAuthFlowPage("/projects")).toBe(false);
    expect(isOnAuthFlowPage("/sales")).toBe(false);
    expect(isOnAuthFlowPage("/settings")).toBe(false);
    expect(isOnAuthFlowPage("/admin")).toBe(false);
  });

  it("handles empty or undefined inputs safely", () => {
    expect(isOnAuthFlowPage("")).toBe(false);
  });
});
