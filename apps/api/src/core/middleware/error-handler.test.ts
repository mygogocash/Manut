import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";

import { errorHandler } from "./error-handler";

vi.mock("@/common/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/events", () => ({
  trackFormValidationFailed: vi.fn(),
}));

const SIGNING_TOKEN = "secret-signing-token-value";

function handleError(error: Error) {
  const req = {
    method: "GET",
    path: `/api/legal-public/sign/${SIGNING_TOKEN}`,
  } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  errorHandler(error, req, res, vi.fn() as unknown as NextFunction);

  return res;
}

describe("errorHandler signing-token redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not log an expired signing token", () => {
    const res = handleError(
      new BadRequestException("This signing link has expired"),
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "GET /api/legal-public/sign/[REDACTED]",
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(SIGNING_TOKEN),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("does not log a signing token for an unknown failure", () => {
    const res = handleError(new Error("unexpected failure"));

    expect(logger.error).toHaveBeenCalledWith(
      "GET /api/legal-public/sign/[REDACTED]",
      expect.objectContaining({ error: "unexpected failure" }),
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining(SIGNING_TOKEN),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
