import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import { errorHandler } from "../src/middleware/error-handler";
import { BadRequestException, ConflictException, ForbiddenException } from "../src/lib/errors";
import type { AppEnv } from "../src/lib/context";

const app = new Hono<AppEnv>()
  .onError(errorHandler)
  .get("/bad", () => { throw new BadRequestException("nope", [{ field: "x", message: "required" }]); })
  .get("/forbidden", () => { throw new ForbiddenException(); })
  .get("/conflict", () => { throw new ConflictException("dup"); })
  .get("/zod", () => { z.object({ a: z.string() }).parse({}); return new Response(); })
  .get("/pg", () => { const e = new Error("duplicate key") as Error & { code: string }; e.code = "23505"; throw e; })
  .get("/boom", () => { throw new Error("secret internals"); });

describe("errorHandler envelope (parity with apps/api)", () => {
  it("HttpException → { error: { code, message, details } }", async () => {
    const res = await app.request("/bad");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: "BAD_REQUEST", message: "nope", details: [{ field: "x", message: "required" }] } });
  });
  it("403 / 409 keep their codes", async () => {
    expect((await app.request("/forbidden")).status).toBe(403);
    expect(await (await app.request("/conflict")).json()).toEqual({ error: { code: "CONFLICT", message: "dup" } });
  });
  it("ZodError → 422 VALIDATION_ERROR with field details", async () => {
    const res = await app.request("/zod");
    expect(res.status).toBe(422);
    const body = await res.json() as { error: { code: string; details: { field?: string }[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details[0]?.field).toBe("a");
  });
  it("unique violation (23505) → 409 CONFLICT like Prisma P2002", async () => {
    expect(await (await app.request("/pg")).json()).toEqual({ error: { code: "CONFLICT", message: "A record with this value already exists" } });
  });
  it("unknown errors never leak their message", async () => {
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });
});
