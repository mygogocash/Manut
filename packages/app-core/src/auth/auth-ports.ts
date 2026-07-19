import { ApiError } from "../api/api-error";
import type {
  AuthLinkResponse,
  AuthLinkTokens,
  AuthSession,
  ChangePasswordInput,
  RecoverPasswordInput,
} from "./auth-types";

/**
 * Provider-neutral session lifecycle used by AuthController.
 * Web (cookie) and native (bearer) adapters implement this today.
 */
export interface SessionAuthPort {
  getMe(): Promise<AuthSession>;
  logout(): Promise<void>;
}

/**
 * Legacy password credential lane.
 * Kept until the password-retirement ADR and Identity Worker cutover.
 * Do not remove from production AuthGateway adapters.
 */
export interface PasswordCredentialPort {
  login(email: string, password: string): Promise<AuthSession>;
  requestPasswordReset(email: string): Promise<AuthLinkResponse>;
  recoverPassword(input: RecoverPasswordInput): Promise<AuthSession>;
  changePassword(input: ChangePasswordInput): Promise<void>;
}

/**
 * Current email-link / token-exchange flow (Manut API / Supabase migration lane).
 * Distinct from the target PasswordlessCeremonyPort (opaque challenge IDs).
 */
export interface AuthLinkPort {
  requestMagicLink(email: string): Promise<AuthLinkResponse>;
  exchangeSession(input: AuthLinkTokens): Promise<AuthSession>;
}

/**
 * Production Expo AuthGateway = session + password + current auth-link.
 * PasswordlessCeremonyPort is intentionally NOT part of this composite yet.
 */
export type AuthGateway = SessionAuthPort &
  PasswordCredentialPort &
  AuthLinkPort;

export type CustomerSignInRequest =
  | { method: "email_magic_link"; email: string; returnPath?: string }
  | { method: "phone_otp"; phoneNumber: string };

export interface PasswordlessChallenge {
  challengeId: string;
  publicStatus: "accepted";
  retryAfterSeconds: number;
  expiresInSeconds: number;
}

export interface VerifiedPhoneContact {
  maskedPhoneNumber: string;
  verifiedAt: number;
}

/**
 * Target customer passwordless ceremony contract (master plan §2.1 / §6).
 * Better Auth / Identity Worker will implement this behind an adapter later.
 * Current Expo Manut API adapters do not implement this port.
 */
export interface PasswordlessCeremonyPort {
  requestCustomerSignIn(
    input: CustomerSignInRequest,
  ): Promise<PasswordlessChallenge>;
  verifyPhoneOtp(challengeId: string, code: string): Promise<AuthSession>;
  consumeEmailMagicLink(
    ceremonyId: string,
    token: string,
  ): Promise<AuthSession>;
  requestPhoneEnrollment(phoneNumber: string): Promise<PasswordlessChallenge>;
  verifyPhoneEnrollment(
    challengeId: string,
    code: string,
  ): Promise<VerifiedPhoneContact>;
  requestPhoneReplacement(phoneNumber: string): Promise<PasswordlessChallenge>;
  verifyPhoneReplacement(
    challengeId: string,
    code: string,
  ): Promise<VerifiedPhoneContact>;
}

function unsupportedPasswordless(method: string): never {
  throw new ApiError(
    501,
    "PASSWORDLESS_NOT_AVAILABLE",
    `Passwordless ceremony "${method}" is not available on this adapter.`,
  );
}

/**
 * Fail-closed stub so callers can depend on PasswordlessCeremonyPort
 * without wiring Better Auth. Production gateways must not use this for
 * password login — that remains on AuthGateway / PasswordCredentialPort.
 */
export function createUnsupportedPasswordlessCeremonyPort(): PasswordlessCeremonyPort {
  return {
    requestCustomerSignIn: async () =>
      unsupportedPasswordless("requestCustomerSignIn"),
    verifyPhoneOtp: async () => unsupportedPasswordless("verifyPhoneOtp"),
    consumeEmailMagicLink: async () =>
      unsupportedPasswordless("consumeEmailMagicLink"),
    requestPhoneEnrollment: async () =>
      unsupportedPasswordless("requestPhoneEnrollment"),
    verifyPhoneEnrollment: async () =>
      unsupportedPasswordless("verifyPhoneEnrollment"),
    requestPhoneReplacement: async () =>
      unsupportedPasswordless("requestPhoneReplacement"),
    verifyPhoneReplacement: async () =>
      unsupportedPasswordless("verifyPhoneReplacement"),
  };
}
