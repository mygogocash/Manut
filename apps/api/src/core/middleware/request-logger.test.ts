import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/common/utils/logger";

import { requestLogger } from "./request-logger";

vi.mock("@/common/utils/logger", () => ({
  logger: {
    info: vi.fn(),
  },
}));

const SIGNING_TOKEN = "secret-signing-token-value";

function logRequest(path: string, originalUrl = path) {
  const req = {
    method: "GET",
    path,
    originalUrl,
  } as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;

  requestLogger(req, res, next);

  return next;
}

describe("requestLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves ordinary request paths", () => {
    const next = logRequest("/api/legal/documents");

    expect(logger.info).toHaveBeenCalledWith("GET /api/legal/documents");
    expect(next).toHaveBeenCalledOnce();
  });

  it("redacts the public legal signing token", () => {
    logRequest(`/api/legal-public/sign/${SIGNING_TOKEN}`);

    expect(logger.info).toHaveBeenCalledWith(
      "GET /api/legal-public/sign/[REDACTED]",
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining(SIGNING_TOKEN),
    );
  });

  it("redacts the token when Express matches a mixed-case route", () => {
    logRequest(`/API/LEGAL-PUBLIC/SIGN/${SIGNING_TOKEN}`);

    expect(logger.info).toHaveBeenCalledWith(
      "GET /API/LEGAL-PUBLIC/SIGN/[REDACTED]",
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining(SIGNING_TOKEN),
    );
  });

  it("redacts the token while preserving the nested decline path", () => {
    logRequest(
      `/api/legal-public/sign/${SIGNING_TOKEN}/decline`,
      `/api/legal-public/sign/${SIGNING_TOKEN}/decline?reason=private`,
    );

    expect(logger.info).toHaveBeenCalledWith(
      "GET /api/legal-public/sign/[REDACTED]/decline",
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining(SIGNING_TOKEN),
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("reason=private"),
    );
  });
});
