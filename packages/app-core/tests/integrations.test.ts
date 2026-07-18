import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  disconnectGoogle,
  getIntegrationsStatus,
  integrationsStatusSchema,
  startGoogleOauth,
} from "../src/integrations/integrations";

describe("integrations contracts", () => {
  it("projects google connection status and strips legacy gmail/drive flags", () => {
    const parsed = integrationsStatusSchema.parse({
      google: {
        connected: true,
        accountEmail: "person@manut.example",
        expiresAt: "2026-08-01T00:00:00.000Z",
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        canSendMail: false,
      },
      gmail: { configured: true, status: "connected" },
      drive: { configured: true, status: "connected" },
    });
    expect(parsed).toEqual({
      google: {
        connected: true,
        accountEmail: "person@manut.example",
        expiresAt: "2026-08-01T00:00:00.000Z",
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        canSendMail: false,
      },
    });
    expect(parsed).not.toHaveProperty("gmail");
  });

  it("loads status, starts oauth with redirect, and disconnects", async () => {
    const signal = { aborted: false };
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        data: { google: { connected: false } },
      })
      .mockResolvedValueOnce({
        data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
      });
    const del = vi.fn().mockResolvedValue({ data: { ok: true } });
    const client = { get, delete: del } as unknown as ApiClient;

    await expect(getIntegrationsStatus(client, signal)).resolves.toEqual({
      google: { connected: false },
    });
    expect(get).toHaveBeenCalledWith("/integrations/status", { signal });

    await expect(
      startGoogleOauth(client, { redirect: "/settings?tab=integrations" }),
    ).resolves.toEqual({
      url: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
    });
    expect(get).toHaveBeenCalledWith(
      "/integrations/google/oauth-start?redirect=%2Fsettings%3Ftab%3Dintegrations",
    );

    await expect(disconnectGoogle(client)).resolves.toEqual({ ok: true });
    expect(del).toHaveBeenCalledWith("/integrations/google");
  });
});
