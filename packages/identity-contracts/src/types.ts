/**
 * Provider-neutral identity types for Epic 1.1+.
 * Feature code and tenant Workers must not import Better Auth types —
 * only these contracts and the AuthGateway boundary in app-core.
 */

export type AuthenticationMethod =
  | "magic_link"
  | "phone_otp"
  | "passkey"
  | "totp"
  | "oauth";

export type AssuranceLevel = "aal1" | "aal2" | "aal3";

export type PasswordlessMethod = "magic_link" | "phone_otp";

export type PasswordlessPurpose =
  | "customer_sign_in"
  | "phone_enrollment"
  | "phone_replacement"
  | "email_reverification"
  | "identity_recovery"
  | "customer_access_recovery";

export interface VerifiedIdentity {
  userId: string;
  sessionId: string;
  amr: AuthenticationMethod[];
  aal: AssuranceLevel;
  acr?: string;
  primaryAuthenticatedAt: number;
  mfaAuthenticatedAt?: number;
  assurancePolicyVersion: string;
  authenticatedByCeremonyId: string;
  freshUntil: number;
  expiresAt: number;
}

export interface CustomerSignInRequest {
  method: PasswordlessMethod;
  /** Normalized email when method is magic_link. */
  email?: string;
  /** E.164 candidate when method is phone_otp (server re-parses). */
  phone?: string;
  /** Allowlisted relative return path for magic-link redemption. */
  returnPath?: string;
}

export interface PasswordlessChallenge {
  /** Opaque ceremony id — same shape for eligible and ineligible inputs. */
  challengeId: string;
  method: PasswordlessMethod;
  purpose: PasswordlessPurpose;
  /** ISO timestamp; public cooldown guidance only. */
  retryAfter: string;
  code: "IDENTITY_SIGN_IN_ACCEPTED";
  message: string;
}

export interface ConsumeEmailMagicLinkInput {
  token: string;
  challengeId?: string;
}

export interface VerifyPhoneOtpInput {
  challengeId: string;
  code: string;
}

export interface RequestPhoneEnrollmentInput {
  phone: string;
}

export interface VerifyPhoneEnrollmentInput {
  challengeId: string;
  code: string;
}

export interface RequestPhoneReplacementInput {
  phone: string;
}

export interface VerifyPhoneReplacementInput {
  challengeId: string;
  code: string;
}

export interface IdentitySession {
  identity: VerifiedIdentity;
}

export interface VerifiedPhoneContact {
  userId: string;
  phoneNumberE164: string;
  phoneNumberVerified: true;
}

export interface IdentityUser {
  id: string;
  email: string;
  emailVerified: boolean;
  phoneNumberE164: string | null;
  phoneNumberVerified: boolean;
  suspended: boolean;
}

export interface CreateInvitedUserInput {
  email: string;
  organizationId: string;
  invitedByUserId: string;
}

export interface IdentityUserQuery {
  cursor?: string;
  limit?: number;
  email?: string;
}

export interface IdentityUserPage {
  items: IdentityUser[];
  nextCursor: string | null;
}

export type ActivationStatus =
  | "pending_invitation"
  | "pending_email_reverification"
  | "active"
  | "suspended"
  | "scheduled_deletion";

export interface IdentityDeletionPolicy {
  reason: string;
  retainAuditHistory: true;
}
