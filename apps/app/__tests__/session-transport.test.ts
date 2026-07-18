import * as SecureStore from "expo-secure-store";

import {
  clearNativeSession,
  createSessionTransport as createNativeTransport,
  getNativeAccessToken,
  persistNativeSession,
} from "@/platform/session-transport.native";
import { createSessionTransport as createWebTransport } from "@/platform/session-transport.web";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("session transports", () => {
  beforeEach(() => {
    jest.mocked(SecureStore.getItemAsync).mockReset();
    jest.mocked(SecureStore.setItemAsync).mockReset();
    jest.mocked(SecureStore.deleteItemAsync).mockReset();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue();
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue();
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

  it("persists native bearer tokens in SecureStore without Supabase", async () => {
    await persistNativeSession({
      accessToken: "native-access-token",
      refreshToken: "native-refresh-token",
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "manut_access_token",
      "native-access-token",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "manut_refresh_token",
      "native-refresh-token",
    );

    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key: string) =>
        key === "manut_access_token" ? "native-access-token" : null,
      );

    await expect(getNativeAccessToken()).resolves.toBe("native-access-token");

    await clearNativeSession();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "manut_access_token",
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "manut_refresh_token",
    );
  });

  it("decorates native requests with bearer auth and X-Manut-Client", async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key: string) =>
        key === "manut_access_token" ? "native-access-token" : null,
      );

    const transport = createNativeTransport("/api");
    await expect(
      transport.decorate({
        url: "/api/auth/me",
        method: "GET",
        headers: { Accept: "application/json" },
      }),
    ).resolves.toEqual({
      url: "/api/auth/me",
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer native-access-token",
        "X-Manut-Client": "native",
      },
      credentials: "omit",
    });
  });

  it("refreshes native sessions via /auth/refresh body + SecureStore", async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key: string) =>
        key === "manut_refresh_token" ? "old-refresh-token" : null,
      );

    const fetchMock = jest.fn(async () =>
      Response.json({
        success: true,
        session: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresIn: 3600,
        },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const transport = createNativeTransport("/api");
    await expect(transport.refresh()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/refresh",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Manut-Client": "native",
        }),
        body: JSON.stringify({ refreshToken: "old-refresh-token" }),
      }),
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "manut_access_token",
      "new-access-token",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "manut_refresh_token",
      "new-refresh-token",
    );
  });
});
