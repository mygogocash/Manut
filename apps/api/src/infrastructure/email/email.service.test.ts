import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/common/utils/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const ORIGINAL_ENV = { ...process.env };

describe("sendWelcomeTemplateEmail", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("posts the welcome template payload to the email service", async () => {
    process.env.EMAIL_SERVICE_API_KEY = "test-email-service-key";
    process.env.EMAIL_SERVICE_URL = "https://dev.send.onewave.live/";

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"ok":true}', { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendWelcomeTemplateEmail } = await import("./email.service");

    await sendWelcomeTemplateEmail({
      to: "new.user@company.com",
      name: "Jane Doe",
      email: "new.user@company.com",
      temporaryPassword: "TempPass123!",
      portalUrl: "https://intranet.company.com",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, request] = fetchMock.mock.calls[0]!;

    expect(url).toBe("https://dev.send.onewave.live/api/emails");
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-email-service-key",
      },
    });
    expect(JSON.parse(request.body as string)).toEqual({
      templateId: "welcome-intranet",
      to: "new.user@company.com",
      variables: {
        BODY: "Your intranet account has been created. Sign in with the details below.",
        name: "Jane Doe",
        portalUrl: "https://intranet.company.com",
        email: "new.user@company.com",
        temporaryPassword: "TempPass123!",
      },
    });
  });
});
