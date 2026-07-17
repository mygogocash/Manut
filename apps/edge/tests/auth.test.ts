import { afterEach, describe, expect, it, vi } from "vitest";

import {
  enforceRefreshOrigin,
  enforceSameOrigin,
  extractCredential,
  isPublicApiRoute,
  verifyAccessToken,
} from "../src/auth";
import { encodeBase64Url } from "../src/crypto";
import { HttpError } from "../src/http-error";
import type { RuntimeBindings } from "../src/runtime";

const encoder = new TextEncoder();

function authEnv(jwksUrl: string): RuntimeBindings {
  return {
    AUTH_AUDIENCE: "authenticated",
    AUTH_ISSUER: "https://issuer.example",
    AUTH_JWKS_URL: jwksUrl,
  } as RuntimeBindings;
}

async function signedJwt(): Promise<{ jwk: JsonWebKey; token: string }> {
  const keys = await crypto.subtle.generateKey(
    {
      hash: "SHA-256",
      modulusLength: 2048,
      name: "RSASSA-PKCS1-v1_5",
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(
    encoder.encode(
      JSON.stringify({ alg: "RS256", kid: "edge-test-key", typ: "JWT" }),
    ),
  );
  const payload = encodeBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: "authenticated",
        exp: now + 300,
        iat: now,
        iss: "https://issuer.example",
        nbf: now - 1,
        role: "employee",
        sub: "employee-123",
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keys.privateKey,
    encoder.encode(signingInput),
  );
  const exported = await crypto.subtle.exportKey("jwk", keys.publicKey);
  return {
    jwk: { ...exported, alg: "RS256", key_ops: ["verify"], use: "sig" },
    token: `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("edge authentication", () => {
  it("extracts only bounded bearer or named session-cookie credentials", () => {
    const token = "credential-token-long-enough";
    expect(
      extractCredential(new Headers({ authorization: `Bearer ${token}` })),
    ).toEqual({
      source: "bearer",
      token,
    });
    expect(
      extractCredential(
        new Headers({ cookie: `other=x; manut_access_token=${token}` }),
      ),
    ).toEqual({ source: "cookie", token });
    expect(
      extractCredential(new Headers({ authorization: `Basic ${token}` })),
    ).toBeNull();
    expect(
      extractCredential(new Headers({ authorization: "Bearer too-short" })),
    ).toBeNull();
  });

  it("keeps public auth routes exact and does not expose retired provider webhooks", () => {
    expect(isPublicApiRoute("POST", "/api/auth/login")).toBe(true);
    expect(isPublicApiRoute("post", "/API/AUTH/LOGIN")).toBe(true);
    expect(isPublicApiRoute("POST", "/api/auth/login/employee")).toBe(false);
    expect(
      isPublicApiRoute("get", "/API/LEGAL-PUBLIC/SIGN/mixed-case-token"),
    ).toBe(true);
    expect(isPublicApiRoute("POST", "/api/legal-public/docusign/webhook")).toBe(
      false,
    );
    expect(isPublicApiRoute("GET", "/api/legal-public/docusign/webhook")).toBe(
      false,
    );
  });

  it("enforces same-origin mutations for cookie credentials", () => {
    const credential = {
      source: "cookie",
      token: "credential-token-long-enough",
    } as const;
    expect(() =>
      enforceSameOrigin(
        new Request("https://intranet.example/api/resource", {
          headers: { origin: "https://intranet.example" },
          method: "POST",
        }),
        credential,
      ),
    ).not.toThrow();
    expect(() =>
      enforceSameOrigin(
        new Request("https://intranet.example/api/resource", {
          headers: { origin: "https://attacker.example" },
          method: "POST",
        }),
        credential,
      ),
    ).toThrowError(HttpError);
  });

  it("requires same-origin refresh requests even after the access token expires", () => {
    expect(() =>
      enforceRefreshOrigin(
        new Request("https://intranet.example/api/auth/refresh", {
          headers: { origin: "https://intranet.example" },
          method: "POST",
        }),
      ),
    ).not.toThrow();
    expect(() =>
      enforceRefreshOrigin(
        new Request("https://intranet.example/api/auth/refresh", {
          headers: { origin: "https://attacker.example" },
          method: "POST",
        }),
      ),
    ).toThrowError(HttpError);
  });

  it("verifies an asymmetric JWT against the configured HTTPS JWKS", async () => {
    const { jwk, token } = await signedJwt();
    const jwksUrl = `https://issuer.example/.well-known/jwks-${crypto.randomUUID()}.json`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ keys: [{ ...jwk, kid: "edge-test-key" }] }),
      ),
    );

    await expect(verifyAccessToken(token, authEnv(jwksUrl))).resolves.toEqual({
      role: "employee",
      subject: "employee-123",
    });
  });

  it("rejects a tampered asymmetric JWT", async () => {
    const { jwk, token } = await signedJwt();
    const jwksUrl = `https://issuer.example/.well-known/jwks-${crypto.randomUUID()}.json`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ keys: [{ ...jwk, kid: "edge-test-key" }] }),
      ),
    );
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) {
      throw new Error("Expected a signed JWT.");
    }
    const replacement = signature.startsWith("A") ? "B" : "A";
    const tampered = `${header}.${payload}.${replacement}${signature.slice(1)}`;

    await expect(
      verifyAccessToken(tampered, authEnv(jwksUrl)),
    ).rejects.toMatchObject({
      code: "INVALID_SESSION",
      status: 401,
    });
  });

  it("surfaces a JWKS network failure as transient rather than invalidating the session", async () => {
    const { token } = await signedJwt();
    const jwksUrl = `https://issuer.example/.well-known/jwks-${crypto.randomUUID()}.json`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network unavailable");
      }),
    );

    await expect(
      verifyAccessToken(token, authEnv(jwksUrl)),
    ).rejects.toMatchObject({
      code: "AUTH_VERIFICATION_UNAVAILABLE",
      status: 503,
    });
  });
});
