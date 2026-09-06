import { describe, expect, it } from "vitest";

import { isExpoClient } from "./expo-client";

describe("isExpoClient", () => {
  it("is true only for the expo client header", () => {
    expect(isExpoClient({ headers: { "x-client": "expo" } })).toBe(true);
    expect(isExpoClient({ headers: { "x-client": ["expo"] } })).toBe(true);
    expect(isExpoClient({ headers: { "x-client": "web" } })).toBe(false);
    expect(isExpoClient({ headers: {} })).toBe(false);
  });
});
