import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  disconnectGoogle,
  getIntegrationsStatus,
  integrationsStatusSchema,
  isGoogleNotConnectedError,
  listDrive,
  listGmail,
  startGoogleOauth,
} from "../src/integrations/integrations";
import { ApiError } from "../src/api/api-error";

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

  it("lists Gmail inbox through the integrations API", async () => {
    const post = vi.fn().mockResolvedValue({
      data: [
        {
          id: "msg-1",
          from: "ops@example.com",
          subject: "Weekly status",
          snippet: "Here is the update",
          labelIds: ["INBOX", "UNREAD"],
          date: "2026-07-01T12:00:00.000Z",
        },
      ],
      nextPageToken: null,
    });
    const client = { post } as unknown as ApiClient;

    await expect(listGmail(client, { folder: "inbox", pageSize: 25 })).resolves.toEqual({
      data: [
        {
          id: "msg-1",
          threadId: null,
          from: "ops@example.com",
          subject: "Weekly status",
          snippet: "Here is the update",
          date: "2026-07-01T12:00:00.000Z",
          unread: true,
        },
      ],
      nextPageToken: null,
    });
    expect(post).toHaveBeenCalledWith("/integrations/gmail/list", {
      folder: "inbox",
      pageSize: 25,
    });
  });

  it("lists Drive files through the integrations API", async () => {
    const post = vi.fn().mockResolvedValue({
      data: [
        {
          id: "drive-file-1",
          name: "Roadmap.gdoc",
          mimeType: "application/vnd.google-apps.document",
          modifiedTime: "2026-07-01T12:00:00.000Z",
          webViewLink: "https://drive.google.com/file/d/drive-file-1/view",
          shared: false,
        },
      ],
      nextPageToken: null,
    });
    const client = { post } as unknown as ApiClient;

    await expect(listDrive(client, { query: "Road" })).resolves.toEqual({
      data: [
        {
          id: "drive-file-1",
          name: "Roadmap.gdoc",
          mimeType: "application/vnd.google-apps.document",
          size: null,
          modifiedTime: "2026-07-01T12:00:00.000Z",
          webViewLink: "https://drive.google.com/file/d/drive-file-1/view",
          shared: false,
        },
      ],
      nextPageToken: null,
    });
    expect(post).toHaveBeenCalledWith("/integrations/drive/list", {
      query: "Road",
      pageSize: 25,
    });
  });

  it("detects Google not-connected API errors", () => {
    expect(
      isGoogleNotConnectedError(
        new ApiError(412, "GOOGLE_NOT_CONNECTED", "Connect Google first"),
      ),
    ).toBe(true);
    expect(
      isGoogleNotConnectedError(new ApiError(403, "FORBIDDEN", "No")),
    ).toBe(false);
  });
});
