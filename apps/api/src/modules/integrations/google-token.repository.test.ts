import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { encrypt } from "@/modules/integrations/crypto";
import { refreshAccessToken } from "@/modules/integrations/google-oauth.service";
import { googleTokenRepository } from "@/modules/integrations/google-token.repository";
import { getTestEnv, mockArgument, setTestEnv } from "@/test-utils/assertions";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    userGoogleConnection: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/modules/integrations/google-oauth.service", () => ({
  refreshAccessToken: vi.fn(),
}));

const VALID_KEY_HEX = "0".repeat(64);

describe("googleTokenRepository", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = getTestEnv("INTEGRATIONS_TOKEN_KEY");
    setTestEnv("INTEGRATIONS_TOKEN_KEY", VALID_KEY_HEX);
  });

  afterEach(() => {
    setTestEnv("INTEGRATIONS_TOKEN_KEY", originalKey);
  });

  describe("upsert", () => {
    it("given tokens > calls prisma upsert with encrypted access + refresh", async () => {
      (prisma.userGoogleConnection.upsert as Mock).mockResolvedValue({});

      await googleTokenRepository.upsert({
        userId: "user-1",
        accountEmail: "a@example.com",
        tokens: {
          accessToken: "raw-AT",
          refreshToken: "raw-RT",
          expiresIn: 3600,
          scope: "openid email",
          tokenType: "Bearer",
        },
      });

      expect(prisma.userGoogleConnection.upsert).toHaveBeenCalledTimes(1);
      const call = mockArgument(
        (prisma.userGoogleConnection.upsert as Mock).mock.calls,
        0,
        0,
      );
      expect(call.where).toEqual({ userId: "user-1" });
      // Encrypted tokens are not the raw values and use the v1: envelope.
      expect(call.create.accessToken.startsWith("v1:")).toBe(true);
      expect(call.create.refreshToken.startsWith("v1:")).toBe(true);
      expect(call.create.accessToken).not.toContain("raw-AT");
      expect(call.create.refreshToken).not.toContain("raw-RT");
      expect(call.update.accessToken.startsWith("v1:")).toBe(true);
      expect(call.create.accountEmail).toBe("a@example.com");
      expect(call.create.tokenType).toBe("Bearer");
      expect(call.create.scope).toBe("openid email");
      expect(call.create.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("getValid", () => {
    it("given fresh row > returns decrypted accessToken without calling refresh", async () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h ahead
      (prisma.userGoogleConnection.findUnique as Mock).mockResolvedValue({
        userId: "u",
        accountEmail: "a@x",
        accessToken: encrypt("plain-AT"),
        refreshToken: encrypt("plain-RT"),
        scope: "openid",
        tokenType: "Bearer",
        expiresAt,
      });

      const out = await googleTokenRepository.getValid("u");
      expect(out.accessToken).toBe("plain-AT");
      expect(out.accountEmail).toBe("a@x");
      expect(out.scope).toBe("openid");
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it("given expired row > calls refreshAccessToken + persists new access token", async () => {
      const expiresAt = new Date(Date.now() + 30 * 1000); // 30s ahead < 60s threshold
      (prisma.userGoogleConnection.findUnique as Mock).mockResolvedValue({
        userId: "u",
        accountEmail: "a@x",
        accessToken: encrypt("old-AT"),
        refreshToken: encrypt("plain-RT"),
        scope: "openid",
        tokenType: "Bearer",
        expiresAt,
      });
      (refreshAccessToken as Mock).mockResolvedValue({
        accessToken: "new-AT",
        expiresIn: 3600,
        scope: "openid",
        tokenType: "Bearer",
      });
      (prisma.userGoogleConnection.update as Mock).mockResolvedValue({});

      setTestEnv("GOOGLE_OAUTH_CLIENT_ID", "cid");
      setTestEnv("GOOGLE_OAUTH_CLIENT_SECRET", "csec");

      const out = await googleTokenRepository.getValid("u");

      expect(refreshAccessToken).toHaveBeenCalledWith({
        refreshToken: "plain-RT",
        clientId: "cid",
        clientSecret: "csec",
      });
      expect(out.accessToken).toBe("new-AT");
      expect(prisma.userGoogleConnection.update).toHaveBeenCalledTimes(1);
      const updateCall = mockArgument(
        (prisma.userGoogleConnection.update as Mock).mock.calls,
        0,
        0,
      );
      expect(updateCall.where).toEqual({ userId: "u" });
      expect(updateCall.data.accessToken.startsWith("v1:")).toBe(true);
      expect(updateCall.data.accessToken).not.toContain("new-AT");

      setTestEnv("GOOGLE_OAUTH_CLIENT_ID", undefined);
      setTestEnv("GOOGLE_OAUTH_CLIENT_SECRET", undefined);
    });

    it("given missing row > throws GOOGLE_NOT_CONNECTED", async () => {
      (prisma.userGoogleConnection.findUnique as Mock).mockResolvedValue(null);
      await expect(googleTokenRepository.getValid("nope")).rejects.toThrow(
        "GOOGLE_NOT_CONNECTED",
      );
    });
  });

  describe("delete", () => {
    it("given existing row > calls prisma delete", async () => {
      (prisma.userGoogleConnection.delete as Mock).mockResolvedValue({});
      await googleTokenRepository.delete("u");
      expect(prisma.userGoogleConnection.delete).toHaveBeenCalledWith({
        where: { userId: "u" },
      });
    });

    it("given missing row (P2025) > does not throw", async () => {
      const err = Object.assign(new Error("not found"), { code: "P2025" });
      (prisma.userGoogleConnection.delete as Mock).mockRejectedValue(err);
      await expect(googleTokenRepository.delete("u")).resolves.toBeUndefined();
    });
  });

  describe("findByUserId", () => {
    it("returns metadata only (no token strings)", async () => {
      const expiresAt = new Date();
      (prisma.userGoogleConnection.findUnique as Mock).mockResolvedValue({
        userId: "u",
        accountEmail: "a@x",
        accessToken: "v1:should-not-leak",
        refreshToken: "v1:should-not-leak",
        scope: "openid",
        expiresAt,
      });

      const meta = await googleTokenRepository.findByUserId("u");
      expect(meta).toEqual({
        connected: true,
        accountEmail: "a@x",
        scope: "openid",
        expiresAt,
      });
      // Make sure the result has no token-shaped fields.
      expect(JSON.stringify(meta)).not.toContain("should-not-leak");
    });

    it("returns connected=false when row missing", async () => {
      (prisma.userGoogleConnection.findUnique as Mock).mockResolvedValue(null);
      const meta = await googleTokenRepository.findByUserId("u");
      expect(meta).toEqual({ connected: false });
    });
  });
});
