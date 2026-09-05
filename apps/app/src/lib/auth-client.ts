import { createAuthClientForApp } from "@nexora/auth/client";
import { getAppUrl } from "./env";

export const authClient = createAuthClientForApp({ baseURL: getAppUrl() });
