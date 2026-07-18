import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import type { RuntimeBindings } from "../src/runtime";

const TEST_TOKEN = "test-token-that-is-long-enough-for-edge-auth";

function testEnv(
  apiOrigin = "",
  limit: RateLimitOutcome = { success: true },
  overrides: Partial<RuntimeBindings> = {},
): RuntimeBindings {
  const bindings: Partial<RuntimeBindings> = {
    API_ORIGIN: apiOrigin,
    API_RATE_LIMITER: {
      limit: vi.fn(async () => limit),
    },
    ...overrides,
  };
  return bindings as RuntimeBindings;
}

const verifyToken = vi.fn(async () => ({ role: "admin", subject: "user-123" }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("edge gateway", () => {
  it("reports health with hardened response headers", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/health",
      {},
      testEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "manut",
      status: "ok",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(response.headers.get("strict-transport-security")).toContain(
      "max-age=31536000",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("requires a verified credential before protected API proxying", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/auth/me",
      {},
      testEnv("https://api.example"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("fails closed when the authenticated API origin is unavailable", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/auth/me",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "API_ORIGIN_NOT_CONFIGURED",
    });
    expect(verifyToken).toHaveBeenCalledWith(TEST_TOKEN, expect.anything());
  });

  it("permits a plain-HTTP API origin only on an exact loopback host", async () => {
    const upstream = vi.fn(async (_request: Request) =>
      Response.json({ authenticated: true }),
    );
    vi.stubGlobal("fetch", upstream);
    const app = createEdgeApp({ verifyToken });
    const localResponse = await app.request(
      "https://intranet.example/api/auth/me?source=local",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv("http://localhost:3001"),
    );

    expect(localResponse.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    const proxiedRequest = upstream.mock.calls[0]?.[0];
    expect(proxiedRequest?.url).toBe(
      "http://localhost:3001/api/auth/me?source=local",
    );

    const remoteResponse = await app.request(
      "https://intranet.example/api/auth/me",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv("http://api.example:3001"),
    );
    expect(remoteResponse.status).toBe(503);
    await expect(remoteResponse.json()).resolves.toMatchObject({
      code: "API_ORIGIN_NOT_CONFIGURED",
    });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("rejects cookie-authenticated mutations without a same-origin Origin header", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/v1/uploads/intents",
      {
        body: JSON.stringify({
          contentType: "text/plain",
          fileName: "report.txt",
          size: 6,
        }),
        headers: {
          "content-type": "application/json",
          cookie: `manut_access_token=${TEST_TOKEN}`,
        },
        method: "POST",
      },
      testEnv(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "CROSS_ORIGIN_REQUEST",
    });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("rejects cross-site WebSocket upgrades that carry browser cookies", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/v1/realtime/rooms/team-room",
      {
        headers: {
          cookie: `manut_access_token=${TEST_TOKEN}`,
          origin: "https://attacker.example",
          upgrade: "websocket",
        },
      },
      testEnv(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "CROSS_ORIGIN_REQUEST",
    });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("rate limits API traffic before authentication or proxying", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/auth/login",
      { method: "POST" },
      testEnv("https://api.example", { success: false }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("returns an R2 presigned upload without exposing its secret signing credential", async () => {
    const secretAccessKey =
      "r2-secret-signing-material-which-must-stay-server-only";
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/v1/uploads/intents",
      {
        body: JSON.stringify({
          contentType: "text/plain",
          fileName: "report.txt",
          size: 6,
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      testEnv(
        "",
        { success: true },
        {
          EDGE_SIGNING_KEY: "edge-intent-key-long-enough-for-test-only-use",
          ENABLE_LOCAL_R2_STREAMING: "false",
          R2_ACCESS_KEY_ID: "A".repeat(32),
          R2_ACCOUNT_ID: "a".repeat(32),
          R2_BUCKET_NAME: "manut-intranet-uploads-test",
          R2_SECRET_ACCESS_KEY: secretAccessKey,
        },
      ),
    );

    expect(response.status).toBe(201);
    const body = await response.text();
    expect(body).not.toContain(secretAccessKey);
    expect(body).not.toContain("R2_SECRET_ACCESS_KEY");
    const result = JSON.parse(body) as {
      requiredHeaders: Record<string, string>;
      transferMode: string;
      uploadUrl: string;
    };
    const uploadUrl = new URL(result.uploadUrl);
    expect(result.transferMode).toBe("r2-presigned");
    expect(uploadUrl.protocol).toBe("https:");
    expect(uploadUrl.searchParams.get("X-Amz-Algorithm")).toBe(
      "AWS4-HMAC-SHA256",
    );
    expect(uploadUrl.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-type",
    );
    expect(result.requiredHeaders).toMatchObject({
      "content-type": "text/plain",
      "x-amz-meta-state": "pending",
    });
  });

  it("keeps Workflow execution closed until an authorization contract exists", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/v1/platform/workflows",
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "POST",
      },
      testEnv(),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "WORKFLOW_AUTHORIZATION_NOT_PROVISIONED",
    });
  });

  it("rejects the retired legal-provider webhook before proxying", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/legal-public/docusign/webhook?attempt=2",
      {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      testEnv("https://api.example/internal/"),
    );

    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
});
