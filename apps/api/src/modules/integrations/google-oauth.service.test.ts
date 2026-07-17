import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAuthUrl,
  exchangeCode,
  fetchUserInfo,
  refreshAccessToken,
  revoke,
} from "@/modules/integrations/google-oauth.service";

describe("google-oauth.service", () => {
  describe("buildAuthUrl", () => {
    it("given state + clientId > returns URL containing all 4 scopes, access_type=offline, prompt=consent, state, client_id", () => {
      const url = buildAuthUrl({
        state: "abc123",
        redirectUri: "http://localhost:3001/cb",
        clientId: "google-client",
      });

      expect(
        url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?"),
      ).toBe(true);
      const parsed = new URL(url);
      expect(parsed.searchParams.get("client_id")).toBe("google-client");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3001/cb",
      );
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("access_type")).toBe("offline");
      expect(parsed.searchParams.get("prompt")).toBe("consent");
      expect(parsed.searchParams.get("state")).toBe("abc123");

      const scope = parsed.searchParams.get("scope") ?? "";
      expect(scope).toContain("openid");
      expect(scope).toContain("email");
      expect(scope).toContain("https://www.googleapis.com/auth/gmail.readonly");
      expect(scope).toContain("https://www.googleapis.com/auth/gmail.compose");
      expect(scope).toContain("https://www.googleapis.com/auth/gmail.send");
      expect(scope).toContain("https://www.googleapis.com/auth/drive.readonly");
      expect(scope).toContain("https://www.googleapis.com/auth/drive.file");
      // mail.google.com + gmail.modify are not in Google's documented MCP
      // scope list — assert absent so we don't drift back.
      expect(scope).not.toContain("https://mail.google.com/");
      expect(scope).not.toContain(
        "https://www.googleapis.com/auth/gmail.modify",
      );
    });
  });

  describe("HTTP-backed helpers", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("exchangeCode", () => {
      it("given 200 token response > returns parsed tokens", async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "AT",
            refresh_token: "RT",
            expires_in: 3600,
            scope: "openid email",
            token_type: "Bearer",
          }),
        });

        const tokens = await exchangeCode({
          code: "the-code",
          redirectUri: "http://r",
          clientId: "cid",
          clientSecret: "csec",
        });

        expect(tokens).toEqual({
          accessToken: "AT",
          refreshToken: "RT",
          expiresIn: 3600,
          scope: "openid email",
          tokenType: "Bearer",
        });
        expect(fetchMock).toHaveBeenCalledWith(
          "https://oauth2.googleapis.com/token",
          expect.objectContaining({ method: "POST" }),
        );
      });

      it("given non-2xx response > throws with body text", async () => {
        fetchMock.mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => "invalid_grant",
        });

        await expect(
          exchangeCode({
            code: "x",
            redirectUri: "r",
            clientId: "c",
            clientSecret: "s",
          }),
        ).rejects.toThrow(/invalid_grant/);
      });
    });

    describe("refreshAccessToken", () => {
      it("given response without refresh_token > returns shape with refreshToken undefined", async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "NEW",
            expires_in: 3600,
            scope: "openid email",
            token_type: "Bearer",
          }),
        });

        const out = await refreshAccessToken({
          refreshToken: "RT",
          clientId: "c",
          clientSecret: "s",
        });

        expect(out.accessToken).toBe("NEW");
        expect(out.refreshToken).toBeUndefined();
        expect(out.expiresIn).toBe(3600);
        expect(out.tokenType).toBe("Bearer");
      });
    });

    describe("fetchUserInfo", () => {
      it("given 200 > returns email + sub", async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ email: "a@example.com", sub: "10001" }),
        });
        const info = await fetchUserInfo("AT");
        expect(info).toEqual({ email: "a@example.com", sub: "10001" });
        expect(fetchMock).toHaveBeenCalledWith(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer AT",
            }),
          }),
        );
      });
    });

    describe("revoke", () => {
      it("given 200 > returns { ok: true }", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200 });
        const r = await revoke("AT");
        expect(r).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledWith(
          "https://oauth2.googleapis.com/revoke?token=AT",
          expect.objectContaining({ method: "POST" }),
        );
      });
    });
  });
});
