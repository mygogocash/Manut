import { describe, expect, it } from "vitest";
import { hc } from "hono/client";
import type { ApiType } from "../src/rpc";

describe("Hono RPC contract", () => {
  it("exposes handbook and leave paths on the typed client", () => {
    const client = hc<ApiType>("http://localhost/api");
    expect(client.handbook).toBeTruthy();
    expect(client.leave).toBeTruthy();
    expect(typeof client.handbook.search.$get).toBe("function");
    expect(typeof client.leave.requests.$post).toBe("function");
  });
});
