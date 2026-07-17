import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

import type { SessionTransport, TransportRequest } from "@manut/app-core";

import { requirePublicEnv } from "./api-config";

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let supabase: SupabaseClient | null = null;

export function getNativeSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;
  const url = requirePublicEnv(
    "EXPO_PUBLIC_SUPABASE_URL",
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  );
  const anonKey = requirePublicEnv(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );
  supabase = createClient(url, anonKey, {
    auth: {
      storage: secureStorage,
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return supabase;
}

export function createSessionTransport(_apiBaseUrl: string): SessionTransport {
  return {
    async decorate(request: TransportRequest) {
      const { data } = await getNativeSupabaseClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return request;
      return {
        ...request,
        headers: { ...request.headers, Authorization: `Bearer ${token}` },
        credentials: "omit",
      };
    },
    async refresh() {
      const { data, error } =
        await getNativeSupabaseClient().auth.refreshSession();
      return !error && Boolean(data.session?.access_token);
    },
    async clear() {
      await getNativeSupabaseClient().auth.signOut({ scope: "local" });
    },
  };
}
