import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Bindings } from "../src/env";

const bindings = env as unknown as Bindings;
const run = async (path: string, init?: RequestInit) => {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`http://localhost${path}`, init), bindings, ctx);
  await waitOnExecutionContext(ctx);
  return res;
};

describe("intranet-edge", () => {
  it("answers /health without touching the database", async () => {
    const res = await run("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", service: "intranet-edge" });
  });

  it("returns the legacy error envelope for unknown API routes", async () => {
    const res = await run("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  it("sets security headers", async () => {
    const res = await run("/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
