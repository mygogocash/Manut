import { create } from "zustand";
import { getAppUrl } from "@/lib/env";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  mustChangePassword?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  roles: Array<{ id: string; name: string; isSystem: boolean; defaultRoute: string | null }>;
  permissions: string[];
  isSystemAdmin: boolean;
  memberships: Array<{ entityId: string; entity: { id: string; name: string; code: string } }>;
  activeEntityId: string | null;
  setSession: (payload: {
    user: AuthUser | null;
    roles?: AuthState["roles"];
    permissions?: string[];
    isSystemAdmin?: boolean;
    memberships?: AuthState["memberships"];
    activeEntityId?: string | null;
  }) => void;
  hasPermission: (code: string) => boolean;
  hasRole: (name: string) => boolean;
  refreshUser: () => Promise<void>;
  clear: () => void;
};

const empty = {
  user: null as AuthUser | null,
  roles: [] as AuthState["roles"],
  permissions: [] as string[],
  isSystemAdmin: false,
  memberships: [] as AuthState["memberships"],
  activeEntityId: null as string | null,
};

export const useAuth = create<AuthState>((set, get) => ({
  ...empty,
  setSession: ({
    user,
    roles = [],
    permissions = [],
    isSystemAdmin = false,
    memberships = [],
    activeEntityId = null,
  }) => set({ user, roles, permissions, isSystemAdmin, memberships, activeEntityId }),
  hasPermission: (code) => get().isSystemAdmin || get().permissions.includes(code),
  hasRole: (name) => get().roles.some((r) => r.name === name),
  clear: () => set(empty),
  refreshUser: async () => {
    const res = await fetch(`${getAppUrl()}/api/auth/me`, { credentials: "include" });
    if (res.status === 401) {
      get().clear();
      return;
    }
    if (!res.ok) throw new Error(`refreshUser failed: ${res.status}`);
    const data = (await res.json()) as {
      user: AuthUser;
      roles: AuthState["roles"];
      permissions: string[];
      memberships?: AuthState["memberships"];
      activeEntityId?: string | null;
    };
    const isSystemAdmin = data.roles.some((r) => r.isSystem && r.name === "Admin");
    get().setSession({
      user: data.user,
      roles: data.roles,
      permissions: data.permissions,
      isSystemAdmin,
      memberships: data.memberships ?? [],
      activeEntityId: data.activeEntityId ?? null,
    });
  },
}));
