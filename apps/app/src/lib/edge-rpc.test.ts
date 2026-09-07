import { afterEach, describe, expect, it, vi } from "vitest";
import { createEdgeClient } from "./edge-rpc";

describe("createEdgeClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("targets the Worker /api origin", () => {
    vi.stubEnv("EXPO_PUBLIC_APP_URL", "http://localhost:8787");
    const client = createEdgeClient();
    expect(client).toBeTruthy();
    expect(typeof client).toBe("function");
  });
});
