import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  debug: vi.fn(),
  group: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_TELEMETRY_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "ph_test_key");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://analytics.manut.test");
  window.history.replaceState({}, "", "/dashboard");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tracking signing-token boundary", () => {
  it("does not initialize analytics on a public signing route", async () => {
    window.history.replaceState(
      {},
      "",
      "/sign/secret-signing-token?source=email",
    );
    const { tracking } = await import("@/lib/tracking");

    tracking.identify("user-1", {});
    tracking.capture("test-event");
    tracking.reset();

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("drops auto-captured events containing a public signing URL", async () => {
    const { tracking } = await import("@/lib/tracking");
    tracking.capture("safe-event");

    expect(posthog.init).toHaveBeenCalledOnce();
    const options = posthog.init.mock.calls[0]?.[1] as {
      before_send: (event: {
        event: string;
        properties: Record<string, unknown>;
      }) => unknown;
      get_current_url: (url: string) => string;
    };
    const event = {
      event: "$pageview",
      properties: {
        $current_url:
          "https://manut.test/sign/secret-signing-token?source=email",
      },
    };

    expect(options.before_send(event)).toBeNull();
    expect(
      options.get_current_url(event.properties.$current_url),
    ).not.toContain("secret-signing-token");
  });

  it("drops and sanitizes a signing token nested in a returnTo query", async () => {
    const { tracking } = await import("@/lib/tracking");
    tracking.capture("safe-event");

    const options = posthog.init.mock.calls[0]?.[1] as {
      before_send: (event: {
        event: string;
        properties: Record<string, unknown>;
      }) => unknown;
      get_current_url: (url: string) => string;
    };
    const currentUrl =
      "https://manut.test/sign-in?returnTo=%2Fsign%2Fsecret-signing-token";
    const event = {
      event: "$pageview",
      properties: { $current_url: currentUrl },
    };

    expect(options.before_send(event)).toBeNull();
    expect(options.get_current_url(currentUrl)).not.toContain(
      "secret-signing-token",
    );
    expect(options.get_current_url(currentUrl)).not.toContain("returnTo");
  });

  it("does not initialize on a page whose query contains a signing token", async () => {
    window.history.replaceState(
      {},
      "",
      "/sign-in?returnTo=%252Fsign%252Fsecret-signing-token",
    );
    const { tracking } = await import("@/lib/tracking");

    tracking.capture("test-event");

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("keeps ordinary analytics events intact", async () => {
    const { tracking } = await import("@/lib/tracking");
    tracking.capture("safe-event");

    const options = posthog.init.mock.calls[0]?.[1] as {
      before_send: (event: {
        event: string;
        properties: Record<string, unknown>;
      }) => unknown;
    };
    const event = {
      event: "$pageview",
      properties: { $current_url: "https://manut.test/dashboard" },
    };

    expect(options.before_send(event)).toBe(event);
  });
});
