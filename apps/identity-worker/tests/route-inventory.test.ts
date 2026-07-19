import { describe, expect, it } from "vitest";

import { createIdentityApp } from "../src/routes/app";
import type { IdentityBindings } from "../src/runtime";

function env(overrides: IdentityBindings = {}): IdentityBindings {
  return {
    IDENTITY_SPIKE_MODE: "stub",
    BETTER_AUTH_PINNED_VERSION: "1.6.23",
    ...overrides,
  };
}

describe("identity worker routes", () => {
  it("health reports fail-closed when Identity D1 is unbound", async () => {
    const app = createIdentityApp();
    const response = await app.request("/health", {}, env());
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      identityDb: string;
      productionAuthCutover: boolean;
    };
    expect(body.ok).toBe(false);
    expect(body.identityDb).toBe("fail_closed");
    expect(body.productionAuthCutover).toBe(false);
  });

  it("blocks stock phone send-otp route", async () => {
    const app = createIdentityApp();
    const response = await app.request(
      "/phone-number/send-otp",
      { method: "POST" },
      env(),
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("IDENTITY_STOCK_PHONE_ROUTE_BLOCKED");
  });

  it("blocks stock password sign-in route", async () => {
    const app = createIdentityApp();
    const response = await app.request(
      "/api/auth/sign-in/email",
      { method: "POST" },
      env(),
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("IDENTITY_PASSWORD_ROUTES_DISABLED");
  });

  it("magic-link sign-in returns enumeration-safe accepted envelope in stub mode", async () => {
    const app = createIdentityApp();
    const response = await app.request(
      "/api/identity/sign-in/magic-link",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      },
      env(),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      code: string;
      method: string;
      challengeId: string;
    };
    expect(body.code).toBe("IDENTITY_SIGN_IN_ACCEPTED");
    expect(body.method).toBe("magic_link");
    expect(body.challengeId.length).toBeGreaterThan(0);
  });

  it("magic-link consume fails closed without Identity D1", async () => {
    const app = createIdentityApp();
    const response = await app.request(
      "/api/identity/magic-link/consume",
      { method: "POST" },
      env(),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("IDENTITY_D1_NOT_PROVISIONED");
  });

  it("config snapshot endpoint exposes pinned magic-link + blocked phone routes", async () => {
    const app = createIdentityApp();
    const response = await app.request(
      "/api/identity/spike/config",
      {},
      env(),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      pinnedVersion: string;
      config: {
        plugins: { magicLink: { storeToken: string; disableSignUp: boolean } };
      };
      blockedStockPhoneRoutes: string[];
      productionAuthCutover: boolean;
    };
    expect(body.pinnedVersion).toBe("1.6.23");
    expect(body.config.plugins.magicLink.storeToken).toBe("hashed");
    expect(body.config.plugins.magicLink.disableSignUp).toBe(true);
    expect(body.blockedStockPhoneRoutes).toContain("/phone-number/verify");
    expect(body.productionAuthCutover).toBe(false);
  });
});
