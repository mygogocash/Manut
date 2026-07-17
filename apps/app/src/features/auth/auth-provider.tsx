import {
  AuthController,
  isEmployeeOnly as rolesAreEmployeeOnly,
  type AuthLinkResponse,
  type AuthLinkTokens,
  type RecoverPasswordInput,
  type AuthState,
  type SessionVerificationError,
} from "@manut/app-core";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { createPlatformAuthGateway } from "@/platform/auth-gateway";
import { useAppBecameActive } from "@/platform/app-visibility";

interface AuthContextValue extends AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmployeeOnly: boolean;
  login(email: string, password: string, returnTo?: string): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  requestPasswordReset(email: string): Promise<AuthLinkResponse>;
  requestMagicLink(email: string): Promise<AuthLinkResponse>;
  exchangeSession(tokens: AuthLinkTokens): Promise<void>;
  recoverPassword(input: RecoverPasswordInput): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  hasPermission(code: string): boolean;
  hasAnyPermission(...codes: string[]): boolean;
  sessionVerificationError: SessionVerificationError | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const UNAUTHENTICATED_CACHE_SIGNATURE = "unauthenticated";

interface AuthorizationQuerySnapshot {
  authState: AuthState;
  queryClient: QueryClient;
  authorizationSignature: string | null;
}

class AuthorizationQueryStore {
  private readonly listeners = new Set<() => void>();
  private unsubscribeController: (() => void) | null = null;
  private snapshot: AuthorizationQuerySnapshot;

  constructor(
    private readonly controller: AuthController,
    queryClient: QueryClient,
  ) {
    this.snapshot = {
      authState: controller.getState(),
      queryClient,
      authorizationSignature: null,
    };
  }

  readonly getSnapshot = (): AuthorizationQuerySnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (!this.unsubscribeController) {
      this.unsubscribeController = this.controller.subscribe(this.synchronize);
      this.synchronize();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.unsubscribeController?.();
        this.unsubscribeController = null;
      }
    };
  };

  replaceQueryClient(queryClient: QueryClient): void {
    if (this.snapshot.queryClient === queryClient) return;

    queryClient.clear();
    this.publish({ ...this.snapshot, queryClient });
  }

  private readonly synchronize = (): void => {
    const authState = this.controller.getState();
    const authorizationSignature = getAuthorizationCacheSignature(authState);
    if (this.snapshot.authorizationSignature !== authorizationSignature) {
      this.snapshot.queryClient.clear();
    }
    this.publish({ ...this.snapshot, authState, authorizationSignature });
  };

  private publish(snapshot: AuthorizationQuerySnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

function getAuthorizationCacheSignature(state: AuthState): string {
  if (state.status !== "authenticated" || !state.user) {
    return UNAUTHENTICATED_CACHE_SIGNATURE;
  }

  return JSON.stringify({
    userId: state.user.id,
    entityId: state.user.entity?.id ?? null,
    mustChangePassword: state.user.mustChangePassword,
    permissions: [...state.permissions].sort(),
    roles: state.roles
      .map(({ id, name, defaultRoute }) => ({ id, name, defaultRoute }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [controller] = useState(
    () => new AuthController(createPlatformAuthGateway()),
  );
  const [authorizationQueryStore] = useState(
    () => new AuthorizationQueryStore(controller, queryClient),
  );
  const authorizationQuerySnapshot = useSyncExternalStore(
    authorizationQueryStore.subscribe,
    authorizationQueryStore.getSnapshot,
    authorizationQueryStore.getSnapshot,
  );
  const state = authorizationQuerySnapshot.authState;
  const authorizationSignature = getAuthorizationCacheSignature(state);
  const isCacheBoundToAuthorization =
    authorizationQuerySnapshot.queryClient === queryClient &&
    authorizationQuerySnapshot.authorizationSignature ===
      authorizationSignature;

  useEffect(() => {
    authorizationQueryStore.replaceQueryClient(queryClient);
    void controller.verifySession();
  }, [authorizationQueryStore, controller, queryClient]);

  const handleAppBecameActive = useCallback(() => {
    if (controller.getState().status === "authenticated") {
      void controller.verifySession();
    }
  }, [controller]);
  useAppBecameActive(handleAppBecameActive);

  const login = useCallback(
    async (email: string, password: string, returnTo?: string) => {
      queryClient.clear();
      const destination = await controller.login(email, password, returnTo);
      router.replace(destination as Href);
    },
    [controller, queryClient, router],
  );

  const logout = useCallback(async () => {
    try {
      await controller.logout();
    } finally {
      queryClient.clear();
      router.replace("/sign-in");
    }
  }, [controller, queryClient, router]);

  const refreshUser = useCallback(async () => {
    await controller.verifySession();
  }, [controller]);

  const requestPasswordReset = useCallback(
    (email: string) => controller.requestPasswordReset(email),
    [controller],
  );

  const requestMagicLink = useCallback(
    (email: string) => controller.requestMagicLink(email),
    [controller],
  );

  const exchangeSession = useCallback(
    async (tokens: AuthLinkTokens) => {
      queryClient.clear();
      const destination = await controller.exchangeSession(tokens);
      router.replace(destination as Href);
    },
    [controller, queryClient, router],
  );

  const recoverPassword = useCallback(
    async (input: RecoverPasswordInput) => {
      queryClient.clear();
      const destination = await controller.recoverPassword(input);
      router.replace(destination as Href);
    },
    [controller, queryClient, router],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const destination = await controller.changePassword(
        currentPassword,
        newPassword,
      );
      router.replace(destination as Href);
    },
    [controller, router],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isLoading: state.status === "checking",
      isAuthenticated: state.status === "authenticated",
      isEmployeeOnly: rolesAreEmployeeOnly(state.roles),
      login,
      logout,
      refreshUser,
      requestPasswordReset,
      requestMagicLink,
      exchangeSession,
      recoverPassword,
      changePassword,
      hasPermission: (code) => state.permissions.includes(code),
      hasAnyPermission: (...codes) =>
        codes.some((code) => state.permissions.includes(code)),
    }),
    [
      state,
      login,
      logout,
      refreshUser,
      requestPasswordReset,
      requestMagicLink,
      exchangeSession,
      recoverPassword,
      changePassword,
    ],
  );

  return (
    <AuthContext value={value}>
      {isCacheBoundToAuthorization ? children : null}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
