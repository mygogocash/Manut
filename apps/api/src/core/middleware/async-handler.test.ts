import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { asyncHandler } from "@/core/middleware/async-handler";

function mockReqRes() {
  const req = {} as Request;
  const res = { json: vi.fn() } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("asyncHandler", () => {
  it("forwards thrown errors to next", async () => {
    const { req, res, next } = mockReqRes();
    const err = new Error("boom");
    const handler = asyncHandler(async () => {
      throw err;
    });

    handler(req, res, next);
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  it("forwards rejected promises to next", async () => {
    const { req, res, next } = mockReqRes();
    const err = new Error("reject");
    const handler = asyncHandler(async () => {
      await Promise.reject(err);
    });

    handler(req, res, next);
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  it("runs successful handlers without calling next", async () => {
    const { req, res, next } = mockReqRes();
    const handler = asyncHandler(async (_req, res) => {
      res.json({ ok: true });
    });

    handler(req, res, next);
    await vi.waitFor(() => {
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
    expect(next).not.toHaveBeenCalled();
  });
});
