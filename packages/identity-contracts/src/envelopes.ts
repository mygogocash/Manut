import { z } from "zod";

import type { PasswordlessChallenge, PasswordlessMethod } from "./types";

/** Enumeration-safe public accept envelope (eligible and ineligible alike). */
export const identitySignInAcceptedSchema = z.object({
  code: z.literal("IDENTITY_SIGN_IN_ACCEPTED"),
  challengeId: z.string().min(1),
  method: z.enum(["magic_link", "phone_otp"]),
  purpose: z.enum([
    "customer_sign_in",
    "phone_enrollment",
    "phone_replacement",
    "email_reverification",
    "identity_recovery",
    "customer_access_recovery",
  ]),
  retryAfter: z.string().datetime(),
  message: z.string().min(1),
});

export type IdentitySignInAccepted = z.infer<
  typeof identitySignInAcceptedSchema
>;

export const IDENTITY_SIGN_IN_ACCEPTED_MESSAGE =
  "If this account can sign in, we sent a one-time credential.";

export function buildSignInAcceptedEnvelope(input: {
  challengeId: string;
  method: PasswordlessMethod;
  retryAfter: Date;
}): PasswordlessChallenge {
  return {
    code: "IDENTITY_SIGN_IN_ACCEPTED",
    challengeId: input.challengeId,
    method: input.method,
    purpose: "customer_sign_in",
    retryAfter: input.retryAfter.toISOString(),
    message: IDENTITY_SIGN_IN_ACCEPTED_MESSAGE,
  };
}

/** Fail-closed capability errors when preview Cloudflare resources are absent. */
export const identityCapabilityErrorSchema = z.object({
  code: z.enum([
    "IDENTITY_D1_NOT_PROVISIONED",
    "IDENTITY_SPIKE_STUB_ONLY",
    "IDENTITY_STOCK_PHONE_ROUTE_BLOCKED",
    "IDENTITY_PASSWORD_ROUTES_DISABLED",
  ]),
  message: z.string(),
});

export type IdentityCapabilityError = z.infer<
  typeof identityCapabilityErrorSchema
>;
