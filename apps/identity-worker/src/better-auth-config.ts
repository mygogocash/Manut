/**
 * Pinned Better Auth production-intent configuration for Epic 1.1.
 *
 * This is a CI-tested snapshot of required semantics from
 * docs/EXPO_CLOUDFLARE_MASTER_PLAN.md §6.4–6.5. Upstream default drift must
 * fail tests — do not rely on library defaults.
 *
 * BETTER_AUTH_PINNED_VERSION must match package install when the adapter is
 * wired. The spike does NOT cut over production auth.
 */

export const BETTER_AUTH_PINNED_VERSION = "1.6.23" as const;

/** Intended companion Expo client package when native SecureStore path is proven. */
export const BETTER_AUTH_EXPO_PINNED_VERSION = "1.6.23" as const;

export const PINNED_BETTER_AUTH_CONFIG = {
  emailAndPassword: {
    enabled: false,
  },
  account: {
    accountLinking: {
      disableImplicitLinking: true,
    },
  },
  session: {
    /** Cookie cache stays disabled until Phase 1 revocation/load gate. */
    cookieCache: {
      enabled: false,
    },
  },
  plugins: {
    magicLink: {
      disableSignUp: true,
      expiresIn: 300,
      storeToken: "hashed",
    },
    phoneNumber: {
      /**
       * Stock public plugin routes are blocked at the Worker.
       * Private wrapper only — see private/phone-challenge-wrapper.ts.
       */
      publicRoutesEnabled: false,
      signUpOnVerification: false,
      otpLength: 6,
      expiresIn: 300,
      maxAttempts: 3,
    },
  },
} as const;

/**
 * Better Auth paths that must never be reachable on the public Identity surface.
 * Stock phone send/verify accept the phone again and may send before eligibility.
 */
export const BLOCKED_STOCK_PHONE_ROUTES = [
  "/phone-number/send-otp",
  "/phone-number/verify",
  "/api/auth/phone-number/send-otp",
  "/api/auth/phone-number/verify",
] as const;

/** Password / credential routes disabled for the passwordless target. */
export const BLOCKED_PASSWORD_ROUTES = [
  "/sign-up/email",
  "/sign-in/email",
  "/forget-password",
  "/reset-password",
  "/change-password",
  "/api/auth/sign-up/email",
  "/api/auth/sign-in/email",
  "/api/auth/forget-password",
  "/api/auth/reset-password",
  "/api/auth/change-password",
] as const;

/** Public spike routes (stub). Production cutover is out of scope. */
export const PUBLIC_IDENTITY_ROUTE_INVENTORY = [
  "GET /health",
  "GET /api/identity/spike/config",
  "POST /api/identity/sign-in/magic-link",
  "POST /api/identity/sign-in/phone",
  "POST /api/identity/magic-link/consume",
  "POST /api/identity/phone/verify",
] as const;

export const ASSURANCE_POLICY_VERSION = "identity-assurance-v1" as const;
