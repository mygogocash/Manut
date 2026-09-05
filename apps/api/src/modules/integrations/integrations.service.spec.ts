import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/common/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockGetValid = vi.fn();
vi.mock("@/modules/integrations/google-token.repository", () => ({
  googleTokenRepository: {
    getValid: mockGetValid,
    upsert: vi.fn(),
    delete: vi.fn(),
    findByUserId: vi.fn(),
  },
}));

async function loadService() {
  const mod = await import("./integrations.service");
  return mod.integrationsService;
}

interface MockResponse {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

function jsonResponse(data: unknown, status = 200): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function errorResponse(status: number, body: string): MockResponse {
  return {
    ok: false,
    status,
    statusText: "Error",
    text: async () => body,
    json: async () => ({}),
  };
}

describe("integrationsService (REST)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockGetValid.mockReset();
    process.env = { ...ORIGINAL_ENV };
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const SEND_SCOPES =
    "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.send";

  function setupGoogleTokenOk(
    accessToken = "ya29.access-token",
    scope = SEND_SCOPES,
  ) {
    mockGetValid.mockResolvedValue({
      accessToken,
      accountEmail: "user@example.com",
      scope,
    });
  }

  describe("listGmail", () => {
    it("given inbox folder > calls list endpoint with labelIds=INBOX then fetches per-message metadata", async () => {
      setupGoogleTokenOk("tok-1");

      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({
            messages: [
              { id: "m1", threadId: "t1" },
              { id: "m2", threadId: "t2" },
            ],
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            id: "m1",
            snippet: "hello",
            internalDate: "1700000000000",
            payload: {
              headers: [
                { name: "From", value: "alice@example.com" },
                { name: "To", value: "me@example.com" },
                { name: "Subject", value: "hi" },
                { name: "Date", value: "Tue, 14 Nov 2023" },
              ],
            },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            id: "m2",
            snippet: "world",
            payload: {
              headers: [
                { name: "From", value: "bob@example.com" },
                { name: "Subject", value: "hello" },
              ],
            },
          }),
        );

      const service = await loadService();
      const result = await service.listGmail("user-1", { folder: "inbox" });

      // First call: list endpoint
      const firstUrl = fetchMock.mock.calls[0][0] as string;
      expect(firstUrl).toContain(
        "gmail.googleapis.com/gmail/v1/users/me/messages",
      );
      expect(firstUrl).toContain("labelIds=INBOX");
      expect(firstUrl).toContain("maxResults=25");

      // Auth header on every call
      for (const call of fetchMock.mock.calls) {
        const init = call[1] as { headers?: Record<string, string> };
        expect(init.headers?.Authorization).toBe("Bearer tok-1");
      }

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: "m1",
        threadId: undefined,
        from: "alice@example.com",
        to: "me@example.com",
        subject: "hi",
        snippet: "hello",
        // listGmail now surfaces labelIds so the FE can render star /
        // unread badges per row without a second metadata round-trip.
        labelIds: [],
        date: "Tue, 14 Nov 2023",
      });
      expect(result.data[1]?.subject).toBe("hello");
    });

    it("given sent folder > uses labelIds=SENT", async () => {
      setupGoogleTokenOk();
      fetchMock.mockResolvedValueOnce(jsonResponse({ messages: [] }));

      const service = await loadService();
      await service.listGmail("user-1", { folder: "sent" });

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("labelIds=SENT");
    });

    it("given drafts folder > uses labelIds=DRAFT", async () => {
      setupGoogleTokenOk();
      fetchMock.mockResolvedValueOnce(jsonResponse({ messages: [] }));

      const service = await loadService();
      await service.listGmail("user-1", { folder: "drafts" });

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("labelIds=DRAFT");
    });

    it("given empty result > returns data: []", async () => {
      setupGoogleTokenOk();
      fetchMock.mockResolvedValueOnce(jsonResponse({}));

      const service = await loadService();
      const result = await service.listGmail("user-1", { folder: "inbox" });

      expect(result.data).toEqual([]);
    });

    it("given Google API 403 > throws underlying error", async () => {
      setupGoogleTokenOk();
      fetchMock.mockResolvedValueOnce(
        errorResponse(403, "Insufficient Permission"),
      );

      const service = await loadService();
      await expect(
        service.listGmail("user-1", { folder: "inbox" }),
      ).rejects.toThrow(/403/);
    });
  });

  describe("readGmail", () => {
    it("given message with text/plain body > decodes base64url body + builds header preamble", async () => {
      setupGoogleTokenOk();

      const bodyText = "hello world";
      const bodyB64 = Buffer.from(bodyText, "utf-8").toString("base64url");

      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          id: "m1",
          payload: {
            mimeType: "text/plain",
            body: { data: bodyB64 },
            headers: [
              { name: "From", value: "alice@example.com" },
              { name: "To", value: "me@example.com" },
              { name: "Subject", value: "hi" },
              { name: "Date", value: "2026-01-01" },
            ],
          },
        }),
      );

      const service = await loadService();
      const result = await service.readGmail("user-1", "m1");

      expect(result.from).toBe("alice@example.com");
      expect(result.subject).toBe("hi");
      expect(result.bodyText).toBe("hello world");
      expect(result.bodyHtml).toBe("");
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("/messages/m1?format=full");
    });

    it("given multipart with html only > strips tags + uses html body", async () => {
      setupGoogleTokenOk();
      const html = "<p>hello <b>world</b></p>";
      const htmlB64 = Buffer.from(html, "utf-8").toString("base64url");

      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          id: "m1",
          payload: {
            mimeType: "multipart/alternative",
            headers: [{ name: "Subject", value: "html only" }],
            parts: [
              {
                mimeType: "text/html",
                body: { data: htmlB64 },
              },
            ],
          },
        }),
      );

      const service = await loadService();
      const result = await service.readGmail("user-1", "m1");

      expect(result.bodyText).toContain("hello world");
      expect(result.bodyText).not.toContain("<p>");
      expect(result.bodyHtml).toBe(html);
    });

    it("given multipart with both text/plain and text/html > prefers text/plain", async () => {
      setupGoogleTokenOk();
      const plain = "plain version";
      const html = "<p>html version</p>";
      const plainB64 = Buffer.from(plain, "utf-8").toString("base64url");
      const htmlB64 = Buffer.from(html, "utf-8").toString("base64url");

      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          id: "m1",
          payload: {
            mimeType: "multipart/alternative",
            headers: [{ name: "Subject", value: "both" }],
            parts: [
              { mimeType: "text/html", body: { data: htmlB64 } },
              { mimeType: "text/plain", body: { data: plainB64 } },
            ],
          },
        }),
      );

      const service = await loadService();
      const result = await service.readGmail("user-1", "m1");

      expect(result.bodyText).toBe("plain version");
      expect(result.bodyHtml).toBe(html);
    });
  });

  describe("sendGmail", () => {
    it("given to/subject/body > POSTs base64url RFC822 to messages/send", async () => {
      setupGoogleTokenOk("tok-9");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ id: "sent-1", threadId: "t-1" }),
      );

      const service = await loadService();
      const result = await service.sendGmail("user-1", {
        to: "x@example.com",
        subject: "hi",
        body: "yo",
      });

      expect(result.result).toContain("sent-1");

      const [url, init] = fetchMock.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: string },
      ];
      expect(url).toBe(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      );
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer tok-9");
      expect(init.headers["Content-Type"]).toBe("application/json");

      const parsed = JSON.parse(init.body) as { raw: string };
      const decoded = Buffer.from(parsed.raw, "base64url").toString("utf-8");
      expect(decoded).toContain("To: x@example.com");
      expect(decoded).toContain("Subject: hi");
      // Body is now base64-encoded inside the RFC822 part (so non-ASCII
      // characters survive the Gmail-API round-trip); assert against
      // the encoded form for the plain "yo" payload.
      const yoB64 = Buffer.from("yo", "utf-8").toString("base64");
      expect(decoded).toContain(yoB64);
    });

    it("given no body > sends empty body", async () => {
      setupGoogleTokenOk();
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: "x" }));

      const service = await loadService();
      await service.sendGmail("user-1", { to: "a@b.c", subject: "s" });

      const init = fetchMock.mock.calls[0][1] as { body: string };
      const parsed = JSON.parse(init.body) as { raw: string };
      const decoded = Buffer.from(parsed.raw, "base64url").toString("utf-8");
      expect(decoded).toContain("To: a@b.c");
      expect(decoded).toContain("Subject: s");
    });

    it("given readonly scope only > throws GOOGLE_SEND_SCOPE_REQUIRED before fetch", async () => {
      setupGoogleTokenOk(
        "tok-readonly",
        "openid https://www.googleapis.com/auth/gmail.readonly",
      );

      const service = await loadService();

      await expect(
        service.sendGmail("user-1", { to: "a@b.c", subject: "s" }),
      ).rejects.toMatchObject({
        code: "GOOGLE_SEND_SCOPE_REQUIRED",
        status: 412,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("given Google 403 insufficient scope > maps to GOOGLE_SEND_SCOPE_REQUIRED", async () => {
      setupGoogleTokenOk();
      fetchMock.mockResolvedValueOnce(
        errorResponse(403, '{"error":{"message":"Insufficient Permission"}}'),
      );

      const { PreconditionRequiredException } =
        await import("@/common/exceptions/precondition-required.exception");
      const service = await loadService();

      await expect(
        service.sendGmail("user-1", { to: "a@b.c", subject: "s", body: "hi" }),
      ).rejects.toBeInstanceOf(PreconditionRequiredException);
    });
  });

  describe("listDrive", () => {
    it("given no query > GETs /files with orderBy + fields", async () => {
      setupGoogleTokenOk("tok-d");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          files: [
            {
              id: "f1",
              name: "report.pdf",
              mimeType: "application/pdf",
              modifiedTime: "2026-01-01T00:00:00Z",
            },
          ],
        }),
      );

      const service = await loadService();
      const result = await service.listDrive("user-1");

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("googleapis.com/drive/v3/files");
      expect(url).toContain("pageSize=25");
      expect(url).toContain("orderBy=modifiedTime+desc");
      expect(url).not.toContain("q=");

      expect(result.data).toEqual([
        {
          id: "f1",
          name: "report.pdf",
          mimeType: "application/pdf",
          modifiedTime: "2026-01-01T00:00:00Z",
        },
      ]);

      const init = fetchMock.mock.calls[0][1] as {
        headers: Record<string, string>;
      };
      expect(init.headers.Authorization).toBe("Bearer tok-d");
    });

    it("given query > forwards as q=name contains '...'", async () => {
      setupGoogleTokenOk();
      fetchMock.mockResolvedValueOnce(jsonResponse({ files: [] }));

      const service = await loadService();
      await service.listDrive("user-1", "design");

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("q=name+contains+%27design%27");
    });

    it("given empty result > returns data: []", async () => {
      setupGoogleTokenOk();
      fetchMock.mockResolvedValueOnce(jsonResponse({}));

      const service = await loadService();
      const result = await service.listDrive("user-1");

      expect(result.data).toEqual([]);
    });
  });

  describe("GOOGLE_NOT_CONNECTED gating", () => {
    it("listGmail > given user without google connection > throws 412 GOOGLE_NOT_CONNECTED + skips fetch", async () => {
      mockGetValid.mockRejectedValueOnce(new Error("GOOGLE_NOT_CONNECTED"));

      const { PreconditionRequiredException } =
        await import("@/common/exceptions/precondition-required.exception");
      const service = await loadService();
      const err = await service
        .listGmail("user-1", { folder: "inbox" })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(PreconditionRequiredException);
      expect((err as { code: string }).code).toBe("GOOGLE_NOT_CONNECTED");
      expect((err as { status: number }).status).toBe(412);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("readGmail > skips fetch when not connected", async () => {
      mockGetValid.mockRejectedValueOnce(new Error("GOOGLE_NOT_CONNECTED"));
      const service = await loadService();
      await service.readGmail("user-1", "msg-1").catch(() => {});
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sendGmail > skips fetch when not connected", async () => {
      mockGetValid.mockRejectedValueOnce(new Error("GOOGLE_NOT_CONNECTED"));
      const service = await loadService();
      await service
        .sendGmail("user-1", { to: "a@b.c", subject: "s" })
        .catch(() => {});
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("listDrive > skips fetch when not connected", async () => {
      mockGetValid.mockRejectedValueOnce(new Error("GOOGLE_NOT_CONNECTED"));
      const service = await loadService();
      await service.listDrive("user-1").catch(() => {});
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
