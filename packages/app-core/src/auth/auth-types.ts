export interface AuthRole {
  id: string;
  name: string;
  defaultRoute: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  department: string | null;
  jobTitle: string | null;
  entity: { id: string; name: string; code: string } | null;
  mustChangePassword: boolean;
}

export interface AuthSession {
  user: AuthUser;
  roles: AuthRole[];
  permissions: string[];
}

export interface AuthLinkTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RecoverPasswordInput extends AuthLinkTokens {
  newPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthLinkResponse {
  success: boolean;
  message: string;
}

export type AuthStatus = "checking" | "anonymous" | "authenticated";

export interface SessionVerificationError {
  kind: "transient";
  code: "NETWORK_ERROR" | "RATE_LIMITED" | "VERIFICATION_FAILED";
  message: string;
  status?: number;
  retryable: true;
}

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  roles: AuthRole[];
  permissions: string[];
  sessionVerificationError: SessionVerificationError | null;
}
