import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import legalPublicRoutes from "@/modules/legal/legal.public.controller";
import { legalService } from "@/modules/legal/legal.service";

const loggerWarn = vi.hoisted(() => vi.fn());

vi.mock("@/common/utils/logger", () => ({
  logger: { warn: loggerWarn },
}));

vi.mock("@/modules/legal/legal.service", () => ({
  legalService: {
    declineSignature: vi.fn().mockResolvedValue({ data: {} }),
    getByToken: vi.fn().mockResolvedValue({ data: { signature: {} } }),
    markViewed: vi.fn().mockResolvedValue(undefined),
    submitSignature: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/legal-public", legalPublicRoutes);
  return app;
}

describe("legal public routes", () => {
  it("keeps the in-house token signing route available", async () => {
    const response = await request(createApp()).get(
      "/api/legal-public/sign/in-house-token",
    );

    expect(response.status).toBe(200);
    expect(legalService.getByToken).toHaveBeenCalledWith("in-house-token");
    expect(legalService.markViewed).toHaveBeenCalledWith("in-house-token");
  });

  it("does not expose the retired DocuSign webhook", async () => {
    const response = await request(createApp())
      .post("/api/legal-public/docusign/webhook")
      .send({ status: "completed" });

    expect(response.status).toBe(404);
  });

  it("reports a non-blocking signing view audit failure without logging the token", async () => {
    vi.mocked(legalService.markViewed).mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const response = await request(createApp()).get(
      "/api/legal-public/sign/secret-signing-token",
    );

    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(loggerWarn).toHaveBeenCalledOnce());
    expect(loggerWarn).toHaveBeenCalledWith(
      "legal signing view audit update failed",
      { err: "database unavailable" },
    );
    expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain(
      "secret-signing-token",
    );
  });
});
