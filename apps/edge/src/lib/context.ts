import type { Db } from "@nexora/db";
import type { Auth } from "@nexora/auth";
import type { Bindings } from "../env";

/** Per-request identity resolved by the auth middleware. */
export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  entityId: string | null;
  roles: string[];
  permissions: string[];
  isSystemAdmin: boolean;
};

export type Variables = {
  requestId: string;
  db: Db;
  auth: Auth;
  user: CurrentUser | null;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
