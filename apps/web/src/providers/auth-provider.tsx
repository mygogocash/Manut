"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { apiErrorStatus } from "@/lib/api-client";
import { isEmployeeOnlyRoles, postLoginPath } from "@/lib/auth-return-path";
import { trackSessionEnded, trackSessionStarted } from "@/lib/events";
import { isPublicSigningPath } from "@/lib/public-signing-path";
import { tracking } from "@/lib/tracking";
import type { AuthRole, AuthUser } from "@/services/auth.service";
import * as authService from "@/services/auth.service";

const REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

export interface SessionVerificationError {
  code: "NETWORK_ERROR" | "RATE_LIMITED" | "VERIFICATION_FAILED";
  message: string;
  status?: number;
  retryable: true;
}

interface AuthState {
  user: AuthUser | null;
  roles: AuthRole[];
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionVerificationError: SessionVerificationError | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
  hasRole: (name: string) => boolean;
  isEmployeeOnly: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function sessionVerificationError(error: unknown): SessionVerificationError {
  const status = apiErrorStatus(error);
  if (status === 429) {
    return {
      code: "RATE_LIMITED",
      message:
        "Session verification was rate limited. Please wait a moment and retry.",
      status,
      retryable: true,
    };
  }
  if (status === 0 || status === undefined) {
    return {
      code: "NETWORK_ERROR",
      message:
        "We couldn't verify your session. Check your connection and retry.",
      ...(status === undefined ? {} : { status }),
      retryable: true,
    };
  }
  return {
    code: "VERIFICATION_FAILED",
    message: "Session verification is temporarily unavailable. Please retry.",
    status,
    retryable: true,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const publicSigningPage = isPublicSigningPath(pathname);
  const [state, setState] = useState<AuthState>({
    user: null,
    roles: [],
    permissions: [],
    isLoading: true,
    isAuthenticated: false,
    sessionVerificationError: null,
  });
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const identifiedUserRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const verificationSequenceRef = useRef(0);

  const refreshUser = useCallback(async () => {
    const sequence = ++verificationSequenceRef.current;
    setState((current) =>
      current.isAuthenticated ? current : { ...current, isLoading: true },
    );
    try {
      const result = await authService.getMe();
      if (sequence !== verificationSequenceRef.current) return;
      setState({
        user: result.user,
        roles: result.roles ?? [],
        permissions: result.permissions ?? [],
        isLoading: false,
        isAuthenticated: true,
        sessionVerificationError: null,
      });

      const roles = result.roles ?? [];
      const employeeOnly =
        roles.length > 0 && roles.every((r) => r.name === "Employee");

      tracking.identify(result.user.id, {
        email: result.user.email,
        name: result.user.name,
        entity_id: result.user.entity?.id ?? null,
        entity_code: result.user.entity?.code ?? null,
        department: result.user.department ?? null,
        job_title: result.user.jobTitle ?? null,
        roles: roles.map((r) => r.name).join(","),
        is_employee_only: employeeOnly,
      });

      if (result.user.entity) {
        tracking.group("entity", result.user.entity.id, {
          code: result.user.entity.code,
          name: result.user.entity.name,
        });
      }

      // Fire session.started exactly once per identified user per page load.
      // refreshUser runs on mount, on visibility-return, and on the periodic
      // timer — guarding on identifiedUserRef stops it from re-firing.
      if (identifiedUserRef.current !== result.user.id) {
        identifiedUserRef.current = result.user.id;
        sessionStartedAtRef.current = Date.now();
        trackSessionStarted({ source: "token_refresh" });
      }
    } catch (error) {
      if (sequence !== verificationSequenceRef.current) return;
      const status = apiErrorStatus(error);
      const terminal = status === 401 || status === 403;

      if (terminal) {
        setState({
          user: null,
          roles: [],
          permissions: [],
          isLoading: false,
          isAuthenticated: false,
          sessionVerificationError: null,
        });
        identifiedUserRef.current = null;
        tracking.reset();
        return;
      }

      const verificationError = sessionVerificationError(error);
      setState((current) =>
        current.isAuthenticated && current.user
          ? {
              ...current,
              isLoading: false,
              sessionVerificationError: verificationError,
            }
          : {
              user: null,
              roles: [],
              permissions: [],
              isLoading: false,
              isAuthenticated: false,
              sessionVerificationError: verificationError,
            },
      );
    }
  }, []);

  const startRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);

    // Refresh both the Supabase JWT (cheap keepalive) AND the cached
    // /me payload (roles + permissions). Without the /me call, an admin
    // granting a new role to a logged-in user has no effect on that
    // user's React state until they fully reload — sidebar modules tied
    // to the new permission stay hidden.
    refreshTimerRef.current = setInterval(() => {
      authService.refreshSession().catch(() => {});
      void refreshUser();
    }, REFRESH_INTERVAL_MS);
  }, [refreshUser]);

  const stopRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (publicSigningPage) {
      ++verificationSequenceRef.current;
      setState((current) => ({
        ...current,
        isLoading: false,
        sessionVerificationError: null,
      }));
      return;
    }
    void refreshUser();
  }, [publicSigningPage, refreshUser]);

  useEffect(() => {
    if (state.isAuthenticated && !publicSigningPage) {
      startRefreshTimer();
    } else {
      stopRefreshTimer();
    }
    return stopRefreshTimer;
  }, [
    publicSigningPage,
    state.isAuthenticated,
    startRefreshTimer,
    stopRefreshTimer,
  ]);

  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        state.isAuthenticated &&
        !publicSigningPage
      ) {
        authService.refreshSession().catch(() => {});
        // Pull /me on tab return so a user whose role was just changed
        // sees the new sidebar / route guards as soon as they switch
        // back to the app.
        void refreshUser();
        startRefreshTimer();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [
    publicSigningPage,
    state.isAuthenticated,
    startRefreshTimer,
    refreshUser,
  ]);

  const login = async (email: string, password: string, returnTo?: string) => {
    ++verificationSequenceRef.current;
    const result = await authService.login(email, password);

    const loginRoles = result.roles ?? [];
    const loginPermissions = result.permissions ?? [];

    setState({
      user: result.user,
      roles: loginRoles,
      permissions: loginPermissions,
      isLoading: false,
      isAuthenticated: true,
      sessionVerificationError: null,
    });

    const employeeOnlyAtLogin =
      loginRoles.length > 0 && loginRoles.every((r) => r.name === "Employee");

    tracking.identify(result.user.id, {
      email: result.user.email,
      name: result.user.name,
      entity_id: result.user.entity?.id ?? null,
      entity_code: result.user.entity?.code ?? null,
      department: result.user.department ?? null,
      job_title: result.user.jobTitle ?? null,
      roles: loginRoles.map((r) => r.name).join(","),
      is_employee_only: employeeOnlyAtLogin,
    });

    if (result.user.entity) {
      tracking.group("entity", result.user.entity.id, {
        code: result.user.entity.code,
        name: result.user.entity.name,
      });
    }

    identifiedUserRef.current = result.user.id;
    sessionStartedAtRef.current = Date.now();
    trackSessionStarted({ source: "login" });
    router.replace(
      postLoginPath(
        {
          mustChangePassword: result.user.mustChangePassword,
          roles: loginRoles,
        },
        returnTo,
      ),
    );
  };

  const logout = async () => {
    ++verificationSequenceRef.current;
    try {
      await authService.logout();
    } catch {
      // ignore
    }
    setState({
      user: null,
      roles: [],
      permissions: [],
      isLoading: false,
      isAuthenticated: false,
      sessionVerificationError: null,
    });
    identifiedUserRef.current = null;
    const startedAt = sessionStartedAtRef.current;
    sessionStartedAtRef.current = null;
    trackSessionEnded(
      startedAt
        ? { duration_seconds: Math.round((Date.now() - startedAt) / 1000) }
        : {},
    );
    tracking.reset();
    router.replace("/sign-in");
  };

  const hasPermission = (code: string) =>
    (state.permissions ?? []).includes(code);
  const hasAnyPermission = (...codes: string[]) =>
    codes.some((c) => (state.permissions ?? []).includes(c));
  const hasRole = (name: string) =>
    (state.roles ?? []).some((r) => r.name === name);

  const roles = state.roles ?? [];
  const isEmployeeOnly = isEmployeeOnlyRoles(roles);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        hasRole,
        isEmployeeOnly,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
