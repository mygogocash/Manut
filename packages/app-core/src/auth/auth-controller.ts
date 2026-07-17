import { ApiError, errorStatus } from "../api/api-error";
import { postLoginPath } from "./return-path";
import type {
  AuthGateway,
  AuthLinkResponse,
  AuthLinkTokens,
  RecoverPasswordInput,
  AuthSession,
  AuthState,
  SessionVerificationError,
} from "./auth-types";

type Listener = () => void;

const INITIAL_STATE: AuthState = {
  status: "checking",
  user: null,
  roles: [],
  permissions: [],
  sessionVerificationError: null,
};

function authenticatedState(session: AuthSession): AuthState {
  return {
    status: "authenticated",
    user: session.user,
    roles: session.roles,
    permissions: session.permissions,
    sessionVerificationError: null,
  };
}

function anonymousState(
  error: SessionVerificationError | null = null,
): AuthState {
  return {
    status: "anonymous",
    user: null,
    roles: [],
    permissions: [],
    sessionVerificationError: error,
  };
}

function transientError(error: unknown): SessionVerificationError {
  const status = errorStatus(error);
  const code =
    status === 429
      ? "RATE_LIMITED"
      : status === 0 || status === undefined
        ? "NETWORK_ERROR"
        : "VERIFICATION_FAILED";
  const fallback =
    code === "RATE_LIMITED"
      ? "Session verification was rate limited. Please retry shortly."
      : code === "NETWORK_ERROR"
        ? "Cannot verify your session. Check your connection and retry."
        : "Session verification is temporarily unavailable. Please retry.";

  return {
    kind: "transient",
    code,
    message: error instanceof Error && error.message ? error.message : fallback,
    ...(status === undefined ? {} : { status }),
    retryable: true,
  };
}

export class AuthController {
  private state: AuthState = INITIAL_STATE;
  private readonly listeners = new Set<Listener>();
  private verificationSequence = 0;

  constructor(private readonly gateway: AuthGateway) {}

  readonly getState = (): AuthState => this.state;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async login(
    email: string,
    password: string,
    returnTo?: string | null,
  ): Promise<string> {
    ++this.verificationSequence;
    const session = await this.gateway.login(email, password);
    this.setState(authenticatedState(session));
    return postLoginPath(session, returnTo);
  }

  requestPasswordReset(email: string): Promise<AuthLinkResponse> {
    return this.gateway.requestPasswordReset(email);
  }

  requestMagicLink(email: string): Promise<AuthLinkResponse> {
    return this.gateway.requestMagicLink(email);
  }

  async exchangeSession(
    tokens: AuthLinkTokens,
    returnTo?: string | null,
  ): Promise<string> {
    ++this.verificationSequence;
    const session = await this.gateway.exchangeSession(tokens);
    this.setState(authenticatedState(session));
    return postLoginPath(session, returnTo);
  }

  async recoverPassword(input: RecoverPasswordInput): Promise<string> {
    ++this.verificationSequence;
    const session = await this.gateway.recoverPassword(input);
    this.setState(authenticatedState(session));
    return postLoginPath(session);
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<string> {
    const email = this.state.user?.email;
    if (this.state.status !== "authenticated" || !email) {
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "Your session expired. Sign in and try again.",
      );
    }

    ++this.verificationSequence;
    await this.gateway.changePassword({ currentPassword, newPassword });
    try {
      const session = await this.gateway.login(email, newPassword);
      this.setState(authenticatedState(session));
      return postLoginPath(session);
    } catch (error) {
      await this.gateway.logout().catch(() => undefined);
      this.setState(anonymousState());
      throw error;
    }
  }

  async verifySession(): Promise<AuthState> {
    const sequence = ++this.verificationSequence;
    const warmState = this.state.status === "authenticated";
    if (!warmState) {
      this.setState({ ...INITIAL_STATE });
    }

    try {
      const session = await this.gateway.getMe();
      if (sequence === this.verificationSequence) {
        this.setState(authenticatedState(session));
      }
    } catch (error) {
      if (sequence !== this.verificationSequence) return this.state;

      const status = errorStatus(error);
      if (status === 401 || status === 403) {
        await this.gateway.logout().catch(() => undefined);
        this.setState(anonymousState());
      } else {
        const verificationError = transientError(error);
        this.setState(
          warmState
            ? { ...this.state, sessionVerificationError: verificationError }
            : anonymousState(verificationError),
        );
      }
    }
    return this.state;
  }

  async logout(): Promise<void> {
    ++this.verificationSequence;
    try {
      await this.gateway.logout();
    } finally {
      this.setState(anonymousState());
    }
  }

  private setState(next: AuthState): void {
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}

export function isTerminalAuthError(error: unknown): boolean {
  const status = errorStatus(error);
  return status === 401 || status === 403;
}

export function authError(status: number, message: string): ApiError {
  return new ApiError(status, "AUTH_ERROR", message);
}
