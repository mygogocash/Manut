import * as SecureStore from "expo-secure-store";

import { createSessionTransport as createNativeTransport } from "@/platform/session-transport.native";
import { createSessionTransport as createWebTransport } from "@/platform/session-transport.web";

const mockGetSession = jest.fn(async () => ({
  data: { session: { access_token: "native-access-token" } },
}));
const mockSupabaseClient = {
  auth: {
    getSession: mockGetSession,
    refreshSession: jest.fn(),
    signOut: jest.fn(),
  },
};
const mockCreateClient = jest.fn(
  (_url: string, _key: string, _options: unknown) => mockSupabaseClient,
);

jest.mock("@supabase/supabase-js", () => ({
  createClient: (
    url: string,
    key: string,
    options: unknown,
  ): typeof mockSupabaseClient => mockCreateClient(url, key, options),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

interface NativeClientOptions {
  auth: {
    flowType: string;
    persistSession: boolean;
    storage: {
      getItem(key: string): Promise<string | null>;
      setItem(key: string, value: string): Promise<void>;
      removeItem(key: string): Promise<void>;
    };
  };
}

describe("session transports", () => {
  beforeAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.invalid";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
  });

  it("uses cookie credentials without adding a browser bearer token", async () => {
    const transport = createWebTransport("/api");
    await expect(
      transport.decorate({
        url: "/api/auth/me",
        method: "GET",
        headers: {},
      }),
    ).resolves.toEqual({
      url: "/api/auth/me",
      method: "GET",
      headers: {},
      credentials: "include",
    });
  });

  it("stores native sessions through SecureStore and decorates with bearer auth", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue("stored-value");
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue();
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue();

    const transport = createNativeTransport("/api");
    const request = await transport.decorate({
      url: "/api/auth/me",
      method: "GET",
      headers: {},
    });
    const options = mockCreateClient.mock.calls[0]?.[2] as NativeClientOptions;

    expect(options.auth).toMatchObject({
      flowType: "pkce",
      persistSession: true,
    });
    expect(request).toMatchObject({
      headers: { Authorization: "Bearer native-access-token" },
      credentials: "omit",
    });
    await options.auth.storage.getItem("session");
    await options.auth.storage.setItem("session", "value");
    await options.auth.storage.removeItem("session");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("session");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("session", "value");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("session");
  });
});
