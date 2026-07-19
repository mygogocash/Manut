import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configuredApiOrigin,
  PROXY_HOP_HEADER,
  proxyApiRequest,
} from "../src/api-proxy";
import { type HttpError } from "../src/http-error";
import type { RuntimeBindings } from "../src/runtime";

function testEnv(apiOrigin: string): RuntimeBindings {
  return { API_ORIGIN: apiOrigin } as RuntimeBindings;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("api proxy topology safety", () => {
  it("rejects an API_ORIGIN that matches the incoming Worker host before fetch", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    await expect(
      proxyApiRequest(
        new Request("https://app.manut.xyz/api/auth/me"),
        testEnv("https://app.manut.xyz"),
      ),
    ).rejects.toMatchObject({
      code: "API_ORIGIN_SELF_PROXY",
      status: 503,
    } satisfies Partial<HttpError>);

    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects hostname match ignoring default HTTPS port and case", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    await expect(
      proxyApiRequest(
        new Request("https://App.Manut.xyz/api/v1/messages"),
        testEnv("https://app.manut.xyz:443"),
      ),
    ).rejects.toMatchObject({
      code: "API_ORIGIN_SELF_PROXY",
      status: 503,
    } satisfies Partial<HttpError>);

    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects a repeated proxy-hop marker before fetch", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    await expect(
      proxyApiRequest(
        new Request("https://intranet.example/api/auth/me", {
          headers: { [PROXY_HOP_HEADER]: "1" },
        }),
        testEnv("https://api.example"),
      ),
    ).rejects.toMatchObject({
      code: "API_PROXY_HOP_LOOP",
      status: 503,
    } satisfies Partial<HttpError>);

    expect(upstream).not.toHaveBeenCalled();
  });

  it("sets a single reserved hop marker on the first proxy hop", async () => {
    const upstream = vi.fn(
      async (_request: Request): Promise<Response> =>
        Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", upstream);

    const response = await proxyApiRequest(
      new Request("https://intranet.example/api/auth/me?q=1", {
        headers: {
          authorization: "Bearer test-token-that-is-long-enough-for-edge-auth",
          cookie: "manut_access_token=should-pass-through",
        },
      }),
      testEnv("https://api.example/internal/"),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    const proxied = upstream.mock.calls[0]?.[0];
    expect(proxied).toBeInstanceOf(Request);
    expect(proxied?.url).toBe("https://api.example/internal/api/auth/me?q=1");
    expect(proxied?.headers.get(PROXY_HOP_HEADER)).toBe("1");
    expect(proxied?.headers.get("x-forwarded-host")).toBe("intranet.example");
    expect(proxied?.headers.get("x-forwarded-proto")).toBe("https");
    expect(proxied?.headers.get("authorization")).toBe(
      "Bearer test-token-that-is-long-enough-for-edge-auth",
    );
  });

  it("still fails closed for empty or unsafe API_ORIGIN values", () => {
    expect(() => configuredApiOrigin("")).toThrow(
      expect.objectContaining({
        code: "API_ORIGIN_NOT_CONFIGURED",
        status: 503,
      }),
    );
    expect(() => configuredApiOrigin("http://api.example")).toThrow(
      expect.objectContaining({
        code: "API_ORIGIN_NOT_CONFIGURED",
        status: 503,
      }),
    );
  });

  it("allows a distinct HTTPS Express origin", async () => {
    const upstream = vi.fn(
      async (_request: Request): Promise<Response> =>
        Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", upstream);

    const response = await proxyApiRequest(
      new Request("https://app.manut.xyz/api/health-proxy"),
      testEnv("https://express.example"),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0]?.[0]?.url).toBe(
      "https://express.example/api/health-proxy",
    );
  });
});
