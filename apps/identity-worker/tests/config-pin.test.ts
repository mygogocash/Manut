import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BETTER_AUTH_PINNED_VERSION,
  BLOCKED_PASSWORD_ROUTES,
  BLOCKED_STOCK_PHONE_ROUTES,
  PINNED_BETTER_AUTH_CONFIG,
  PUBLIC_IDENTITY_ROUTE_INVENTORY,
} from "../src/better-auth-config";

const root = dirname(fileURLToPath(import.meta.url));

describe("better-auth config pin", () => {
  it("pins magic-link direction: hashed token, no signup, 300s expiry", () => {
    expect(BETTER_AUTH_PINNED_VERSION).toBe("1.6.23");
    expect(PINNED_BETTER_AUTH_CONFIG.emailAndPassword.enabled).toBe(false);
    expect(PINNED_BETTER_AUTH_CONFIG.plugins.magicLink.disableSignUp).toBe(
      true,
    );
    expect(PINNED_BETTER_AUTH_CONFIG.plugins.magicLink.expiresIn).toBe(300);
    expect(PINNED_BETTER_AUTH_CONFIG.plugins.magicLink.storeToken).toBe(
      "hashed",
    );
  });

  it("disables implicit linking and session cookie cache by default", () => {
    expect(
      PINNED_BETTER_AUTH_CONFIG.account.accountLinking.disableImplicitLinking,
    ).toBe(true);
    expect(PINNED_BETTER_AUTH_CONFIG.session.cookieCache.enabled).toBe(false);
  });

  it("blocks stock phone public routes and signUpOnVerification", () => {
    expect(
      PINNED_BETTER_AUTH_CONFIG.plugins.phoneNumber.publicRoutesEnabled,
    ).toBe(false);
    expect(
      PINNED_BETTER_AUTH_CONFIG.plugins.phoneNumber.signUpOnVerification,
    ).toBe(false);
    expect(BLOCKED_STOCK_PHONE_ROUTES).toContain("/phone-number/send-otp");
    expect(BLOCKED_STOCK_PHONE_ROUTES).toContain("/phone-number/verify");
  });

  it("keeps password routes in the blocked inventory", () => {
    expect(BLOCKED_PASSWORD_ROUTES).toContain("/sign-in/email");
    expect(BLOCKED_PASSWORD_ROUTES).toContain("/api/auth/sign-up/email");
  });

  it("exposes a stable public route inventory for CI drift checks", () => {
    expect(PUBLIC_IDENTITY_ROUTE_INVENTORY).toContain(
      "POST /api/identity/sign-in/magic-link",
    );
    expect(PUBLIC_IDENTITY_ROUTE_INVENTORY).not.toContain(
      "POST /phone-number/send-otp",
    );
  });

  it("wrangler keeps d1_databases and hyperdrive empty (no invented ids)", () => {
    const wranglerPath = join(root, "..", "wrangler.jsonc");
    const raw = readFileSync(wranglerPath, "utf8");
    expect(raw).toMatch(/"d1_databases"\s*:\s*\[\s*\]/);
    expect(raw).toMatch(/"hyperdrive"\s*:\s*\[\s*\]/);
    expect(raw).toContain(
      `"BETTER_AUTH_PINNED_VERSION": "${BETTER_AUTH_PINNED_VERSION}"`,
    );
    // Fail if a concrete Cloudflare resource id was invented in-repo.
    expect(raw).not.toMatch(/"database_id"\s*:\s*"[a-f0-9-]{8,}/i);
    expect(raw).not.toMatch(/"id"\s*:\s*"[a-f0-9]{32}"/i);
  });
});
