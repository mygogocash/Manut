/**
 * Private phone challenge wrapper (Epic 1.1 direction).
 *
 * Stock Better Auth `/phone-number/send-otp` and `/phone-number/verify` are
 * blocked on the public surface. Public clients submit opaque `challengeId`
 * (+ code on verify). Eligibility, E.164 normalization, budget/sponsor checks,
 * and keyed OTP verifiers run inside this trust boundary before any SMS send.
 *
 * This module is a contract stub only — no provider SMS, no Better Auth phone
 * plugin invocation, no production cutover.
 */

export type PrivatePhoneCeremonyPurpose =
  | "customer_sign_in"
  | "phone_enrollment"
  | "phone_replacement";

export interface PrivatePhoneSendInput {
  /** Already eligibility-checked identity id, or null for ineligible path. */
  identityId: string | null;
  phoneE164: string;
  purpose: PrivatePhoneCeremonyPurpose;
  challengeId: string;
}

export interface PrivatePhoneVerifyInput {
  challengeId: string;
  code: string;
  purpose: PrivatePhoneCeremonyPurpose;
}

export interface PrivatePhoneSendResult {
  /** True only when a ceremony + encrypted SMS intent would be persisted. */
  ceremonyCreated: boolean;
  challengeId: string;
}

export interface PrivatePhoneVerifyResult {
  ok: boolean;
  identityId: string | null;
  reason:
    | "stub_not_wired"
    | "invalid_or_exhausted"
    | "verified";
}

/**
 * Identifier-only / keyed-verifier contract the real adapter must implement.
 * Stub always reports not wired so callers fail closed rather than invent OTP.
 */
export interface PrivatePhoneChallengeWrapper {
  send(input: PrivatePhoneSendInput): Promise<PrivatePhoneSendResult>;
  verify(input: PrivatePhoneVerifyInput): Promise<PrivatePhoneVerifyResult>;
}

export function createStubPhoneChallengeWrapper(): PrivatePhoneChallengeWrapper {
  return {
    async send(input) {
      return {
        ceremonyCreated: false,
        challengeId: input.challengeId,
      };
    },
    async verify() {
      return {
        ok: false,
        identityId: null,
        reason: "stub_not_wired",
      };
    },
  };
}
