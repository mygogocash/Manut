import { create } from "zustand";
import { api, ApiError } from "@/lib/api-client";
import { clearSession, loadSession, saveSession, type ExpoSession } from "@/lib/session";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  mustChangePassword?: boolean;
};

type AuthRole = { id: string; name: string; isSystem: boolean; defaultRoute: string | null };

type AuthState = {
  user: AuthUser | null;
  roles: AuthRole[];
  permissions: string[];
  isSystemAdmin: boolean;
  isEmployeeOnly: boolean;
  memberships: Array<{ entityId: string; entity: { id: string; name: string; code: string } }>;
  activeEntityId: string | null;
  setSession: (payload: {
    user: AuthUser | null;
    roles?: AuthRole[];
    permissions?: string[];
    isSystemAdmin?: boolean;
    memberships?: AuthState["memberships"];
    activeEntityId?: string | null;
  }) => void;
  hasPermission: (code: string) => boolean;
  hasRole: (name: string) => boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clear: () => void;
};

const empty = {
  user: null as AuthUser | null,
  roles: [] as AuthRole[],
  permissions: [] as string[],
  isSystemAdmin: false,
  isEmployeeOnly: false,
  memberships: [] as AuthState["memberships"],
  activeEntityId: null as string | null,
};

type MeResponse = {
  user: AuthUser;
  roles: AuthRole[];
  permissions: string[];
  memberships?: AuthState["memberships"];
  activeEntityId?: string | null;
  session?: ExpoSession;
};

function applyMe(get: () => AuthState, data: MeResponse) {
  const isSystemAdmin = data.roles.some((r) => r.isSystem && r.name === "Admin");
  get().setSession({
    user: data.user,
    roles: data.roles,
    permissions: data.permissions,
    isSystemAdmin,
    memberships: data.memberships ?? [],
    activeEntityId: data.activeEntityId ?? null,
  });
}

export const useAuth = create<AuthState>((set, get) => ({
  ...empty,
  setSession: ({
    user,
    roles = [],
    permissions = [],
    isSystemAdmin = false,
    memberships = [],
    activeEntityId = null,
  }) => {
    const isEmployeeOnly = roles.length > 0 && roles.every((r) => r.name === "Employee");
    set({ user, roles, permissions, isSystemAdmin, memberships, activeEntityId, isEmployeeOnly });
  },
  hasPermission: (code) => get().isSystemAdmin || get().permissions.includes(code),
  hasRole: (name) => get().roles.some((r) => r.name === name),
  clear: () => {
    clearSession();
    set(empty);
  },
  login: async (email, password, remember = true) => {
    const data = await api.post<MeResponse>("/auth/login", { email, password });
    if (!data.session?.accessToken || !data.session.refreshToken) {
      throw new Error("Sign-in did not return a session");
    }
    saveSession(data.session, remember);
    applyMe(get, data);
  },
  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // still clear local session
    }
    get().clear();
  },
  refreshUser: async () => {
    // No stored session — skip the probe so a fresh visit doesn't log a
    // predictable 401 in the browser console.
    if (!loadSession()) {
      get().clear();
      return;
    }
    try {
      const data = await api.get<MeResponse>("/auth/me");
      applyMe(get, data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        get().clear();
        return;
      }
      throw e;
    }
  },
}));
