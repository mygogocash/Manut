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
import * as googleOauthService from "@/modules/integrations/google-oauth.service";
import { googleTokenRepository } from "@/modules/integrations/google-token.repository";
import { integrationsService } from "@/modules/integrations/integrations.service";
import { mockArgument, setTestEnv } from "@/test-utils/assertions";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    googleOauthState: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
  },
}));

vi.mock("@/modules/integrations/google-oauth.service", () => ({
  buildAuthUrl: vi.fn(),
  exchangeCode: vi.fn(),
  fetchUserInfo: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/modules/integrations/google-token.repository", () => ({
  googleTokenRepository: {
    upsert: vi.fn(),
    delete: vi.fn(),
    findByUserId: vi.fn(),
    getValid: vi.fn(),
  },
}));

const ENV_KEYS = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
] as const;

describe("integrationsService.startOauth", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    setTestEnv("GOOGLE_OAUTH_CLIENT_ID", "cid");
    setTestEnv("GOOGLE_OAUTH_CLIENT_SECRET", "csec");
    setTestEnv("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:3001/cb");
    (googleOauthService.buildAuthUrl as Mock).mockImplementation(
      ({ state }: { state: string }) =>
        `https://accounts.google.com/x?state=${state}`,
    );
    (prisma.googleOauthState.create as Mock).mockResolvedValue({});
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("given valid env > inserts state row + returns URL with that state", async () => {
    const out = await integrationsService.startOauth({
      userId: "u-1",
      redirect: "/settings",
    });
    expect(out.url).toMatch(/^https:\/\/accounts\.google\.com\/x\?state=/);

    expect(prisma.googleOauthState.create).toHaveBeenCalledTimes(1);
    const createCall = mockArgument(
      (prisma.googleOauthState.create as Mock).mock.calls,
      0,
      0,
    );
    expect(createCall.data.userId).toBe("u-1");
    expect(createCall.data.redirect).toBe("/settings");
    expect(typeof createCall.data.state).toBe("string");
    expect(createCall.data.state.length).toBeGreaterThanOrEqual(32);
    expect(createCall.data.expiresAt).toBeInstanceOf(Date);
    expect(createCall.data.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // state in DB must equal state in URL
    const urlState = new URL(out.url).searchParams.get("state");
    expect(urlState).toBe(createCall.data.state);
  });

  it("given missing GOOGLE_OAUTH_CLIENT_ID > throws", async () => {
    setTestEnv("GOOGLE_OAUTH_CLIENT_ID", undefined);
    await expect(
      integrationsService.startOauth({ userId: "u" }),
    ).rejects.toThrow(/GOOGLE_OAUTH_CLIENT_ID/);
  });
});

describe("integrationsService.completeOauth", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    setTestEnv("GOOGLE_OAUTH_CLIENT_ID", "cid");
    setTestEnv("GOOGLE_OAUTH_CLIENT_SECRET", "csec");
    setTestEnv("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:3001/cb");
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("given valid code + state > exchanges, fetches userinfo, upserts tokens", async () => {
    (prisma.googleOauthState.findUnique as Mock).mockResolvedValue({
      state: "S",
      userId: "u-1",
      redirect: "/settings",
      expiresAt: new Date(Date.now() + 60 * 1000),
    });
    (prisma.googleOauthState.delete as Mock).mockResolvedValue({});
    (googleOauthService.exchangeCode as Mock).mockResolvedValue({
      accessToken: "AT",
      refreshToken: "RT",
      expiresIn: 3600,
      scope: "openid email",
      tokenType: "Bearer",
    });
    (googleOauthService.fetchUserInfo as Mock).mockResolvedValue({
      email: "user@example.com",
      sub: "111",
    });
    (googleTokenRepository.upsert as Mock).mockResolvedValue(undefined);

    const out = await integrationsService.completeOauth({
      code: "the-code",
      state: "S",
    });

    expect(out).toEqual({
      accountEmail: "user@example.com",
      redirect: "/settings",
    });
    expect(prisma.googleOauthState.delete).toHaveBeenCalledWith({
      where: { state: "S" },
    });
    expect(googleOauthService.exchangeCode).toHaveBeenCalledWith({
      code: "the-code",
      redirectUri: "http://localhost:3001/cb",
      clientId: "cid",
      clientSecret: "csec",
    });
    expect(googleOauthService.fetchUserInfo).toHaveBeenCalledWith("AT");
    expect(googleTokenRepository.upsert).toHaveBeenCalledWith({
      userId: "u-1",
      accountEmail: "user@example.com",
      tokens: expect.objectContaining({
        accessToken: "AT",
        refreshToken: "RT",
      }),
    });
  });

  it("given expired state > throws INVALID_OR_EXPIRED_STATE + state row deleted", async () => {
    (prisma.googleOauthState.findUnique as Mock).mockResolvedValue({
      state: "S",
      userId: "u-1",
      redirect: null,
      expiresAt: new Date(Date.now() - 1000), // expired
    });
    (prisma.googleOauthState.delete as Mock).mockResolvedValue({});

    await expect(
      integrationsService.completeOauth({ code: "C", state: "S" }),
    ).rejects.toThrow(/INVALID_OR_EXPIRED_STATE/);

    expect(prisma.googleOauthState.delete).toHaveBeenCalledWith({
      where: { state: "S" },
    });
    expect(googleOauthService.exchangeCode).not.toHaveBeenCalled();
  });

  it("given missing state > throws INVALID_OR_EXPIRED_STATE", async () => {
    (prisma.googleOauthState.findUnique as Mock).mockResolvedValue(null);

    await expect(
      integrationsService.completeOauth({ code: "C", state: "nope" }),
    ).rejects.toThrow(/INVALID_OR_EXPIRED_STATE/);
    expect(googleOauthService.exchangeCode).not.toHaveBeenCalled();
  });
});

describe("integrationsService.disconnect", () => {
  it("given existing row > revokes + deletes", async () => {
    (googleTokenRepository.getValid as Mock).mockResolvedValue({
      accessToken: "AT",
      accountEmail: "u@x",
      scope: "openid",
    });
    (googleOauthService.revoke as Mock).mockResolvedValue({ ok: true });
    (googleTokenRepository.delete as Mock).mockResolvedValue(undefined);

    const out = await integrationsService.disconnect({ userId: "u-1" });

    expect(out).toEqual({ ok: true });
    expect(googleOauthService.revoke).toHaveBeenCalledWith("AT");
    expect(googleTokenRepository.delete).toHaveBeenCalledWith("u-1");
  });

  it("given missing row > does not throw, still calls delete", async () => {
    (googleTokenRepository.getValid as Mock).mockRejectedValue(
      new Error("GOOGLE_NOT_CONNECTED"),
    );
    (googleTokenRepository.delete as Mock).mockResolvedValue(undefined);

    const out = await integrationsService.disconnect({ userId: "u-1" });
    expect(out).toEqual({ ok: true });
    expect(googleOauthService.revoke).not.toHaveBeenCalled();
    expect(googleTokenRepository.delete).toHaveBeenCalledWith("u-1");
  });

  it("given revoke failure > still deletes (revoke best-effort)", async () => {
    (googleTokenRepository.getValid as Mock).mockResolvedValue({
      accessToken: "AT",
      accountEmail: "u@x",
      scope: "openid",
    });
    (googleOauthService.revoke as Mock).mockRejectedValue(
      new Error("network fail"),
    );
    (googleTokenRepository.delete as Mock).mockResolvedValue(undefined);

    const out = await integrationsService.disconnect({ userId: "u-1" });
    expect(out).toEqual({ ok: true });
    expect(googleTokenRepository.delete).toHaveBeenCalledWith("u-1");
  });
});

describe("integrationsService.getStatus", () => {
  it("given user with connection > returns google.connected=true + email", async () => {
    const expiresAt = new Date(Date.now() + 3600 * 1000);
    (googleTokenRepository.findByUserId as Mock).mockResolvedValue({
      connected: true,
      accountEmail: "u@x",
      scope: "openid email",
      expiresAt,
    });

    const status = await integrationsService.getStatus("u-1");
    expect(status.google).toEqual({
      connected: true,
      accountEmail: "u@x",
      scope: "openid email",
      expiresAt: expiresAt.toISOString(),
      // `canSendMail` reflects whether the granted scope set includes
      // gmail.send. The `openid email` mock here lacks it.
      canSendMail: false,
    });
    // Approved Google integration status keys are preserved.
    expect(status.gmail).toBeDefined();
    expect(status.drive).toBeDefined();
  });

  it("given user without connection > returns google.connected=false", async () => {
    (googleTokenRepository.findByUserId as Mock).mockResolvedValue({
      connected: false,
    });

    const status = await integrationsService.getStatus("u-1");
    expect(status.google).toEqual({ connected: false });
  });
});
