import type {
  ActivationStatus,
  ConsumeEmailMagicLinkInput,
  CreateInvitedUserInput,
  CustomerSignInRequest,
  IdentityDeletionPolicy,
  IdentitySession,
  IdentityUser,
  IdentityUserPage,
  IdentityUserQuery,
  PasswordlessChallenge,
  RequestPhoneEnrollmentInput,
  RequestPhoneReplacementInput,
  VerifiedIdentity,
  VerifiedPhoneContact,
  VerifyPhoneEnrollmentInput,
  VerifyPhoneOtpInput,
  VerifyPhoneReplacementInput,
} from "./types";

/**
 * Application-owned identity boundary (master plan §6.1).
 * Better Auth is an adapter behind this port — never imported by features.
 */
export interface IdentityPort {
  authenticate(request: Request): Promise<VerifiedIdentity | null>;
  createInvitedUser(input: CreateInvitedUserInput): Promise<IdentityUser>;
  requestCustomerSignIn(
    input: CustomerSignInRequest,
  ): Promise<PasswordlessChallenge>;
  verifyPhoneOtp(input: VerifyPhoneOtpInput): Promise<IdentitySession>;
  consumeEmailMagicLink(
    input: ConsumeEmailMagicLinkInput,
  ): Promise<IdentitySession>;
  requestPhoneEnrollment(
    input: RequestPhoneEnrollmentInput,
  ): Promise<PasswordlessChallenge>;
  verifyPhoneEnrollment(
    input: VerifyPhoneEnrollmentInput,
  ): Promise<VerifiedPhoneContact>;
  requestPhoneReplacement(
    input: RequestPhoneReplacementInput,
  ): Promise<PasswordlessChallenge>;
  verifyPhoneReplacement(
    input: VerifyPhoneReplacementInput,
  ): Promise<VerifiedPhoneContact>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
  suspendUser(userId: string, reason: string): Promise<void>;
}

export interface IdentityAdministrationPort {
  listUsers(input: IdentityUserQuery): Promise<IdentityUserPage>;
  getActivationStatus(userId: string): Promise<ActivationStatus>;
  resendInvitation(userId: string): Promise<void>;
  startIdentityRecovery(userId: string): Promise<void>;
  reactivateUser(userId: string): Promise<void>;
  scheduleDeletion(
    userId: string,
    policy: IdentityDeletionPolicy,
  ): Promise<{ operationId: string }>;
}
