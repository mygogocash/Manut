import {
  buildSignInAcceptedEnvelope,
  type CustomerSignInRequest,
  type IdentityPort,
  type PasswordlessChallenge,
} from "@manut/identity-contracts";

import { IdentityHttpError, requireIdentityDb } from "../fail-closed";
import { createStubPhoneChallengeWrapper } from "../private/phone-challenge-wrapper";
import type { IdentityBindings } from "../runtime";
import { isStubMode } from "../runtime";

/**
 * Stub IdentityPort adapter for the Epic 1.1 spike.
 *
 * Real Better Auth + D1 wiring is gated on:
 * 1. Manut-owned preview Identity D1 binding (no invented ids)
 * 2. Pinned better-auth@1.6.23 install + reviewed generated schema
 * 3. Magic-link / private phone wrapper security gates
 *
 * Production Supabase/Express auth is NOT replaced by this adapter.
 */
export function createBetterAuthStubPort(
  env: IdentityBindings,
): IdentityPort {
  const phoneWrapper = createStubPhoneChallengeWrapper();

  return {
    async authenticate() {
      requireIdentityDb(env);
      throw stubOnly("authenticate");
    },

    async createInvitedUser() {
      requireIdentityDb(env);
      throw stubOnly("createInvitedUser");
    },

    async requestCustomerSignIn(
      input: CustomerSignInRequest,
    ): Promise<PasswordlessChallenge> {
      // Enumeration-safe shape is available in stub mode; durable ceremony
      // persistence requires Identity D1 and remains fail-closed.
      if (!isStubMode(env)) {
        requireIdentityDb(env);
      }

      const challengeId = crypto.randomUUID();
      const retryAfter = new Date(Date.now() + 60_000);

      if (input.method === "phone_otp") {
        await phoneWrapper.send({
          identityId: null,
          phoneE164: input.phone ?? "",
          purpose: "customer_sign_in",
          challengeId,
        });
      }

      return buildSignInAcceptedEnvelope({
        challengeId,
        method: input.method,
        retryAfter,
      });
    },

    async verifyPhoneOtp() {
      requireIdentityDb(env);
      throw stubOnly("verifyPhoneOtp");
    },

    async consumeEmailMagicLink() {
      requireIdentityDb(env);
      throw stubOnly("consumeEmailMagicLink");
    },

    async requestPhoneEnrollment() {
      requireIdentityDb(env);
      throw stubOnly("requestPhoneEnrollment");
    },

    async verifyPhoneEnrollment() {
      requireIdentityDb(env);
      throw stubOnly("verifyPhoneEnrollment");
    },

    async requestPhoneReplacement() {
      requireIdentityDb(env);
      throw stubOnly("requestPhoneReplacement");
    },

    async verifyPhoneReplacement() {
      requireIdentityDb(env);
      throw stubOnly("verifyPhoneReplacement");
    },

    async revokeSession() {
      requireIdentityDb(env);
      throw stubOnly("revokeSession");
    },

    async revokeAllSessions() {
      requireIdentityDb(env);
      throw stubOnly("revokeAllSessions");
    },

    async suspendUser() {
      requireIdentityDb(env);
      throw stubOnly("suspendUser");
    },
  };
}

function stubOnly(operation: string): IdentityHttpError {
  return new IdentityHttpError(
    503,
    "IDENTITY_SPIKE_STUB_ONLY",
    `Identity spike stub cannot perform "${operation}". Production auth is unchanged.`,
  );
}
