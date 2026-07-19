import { Platform } from "react-native";

import { getApiBaseUrl } from "@/platform/api-config";

describe("getApiBaseUrl > EXPO_PUBLIC_API_URL /api contract", () => {
  const previousApi = process.env.EXPO_PUBLIC_API_URL;
  const previousOs = Platform.OS;

  afterEach(() => {
    if (previousApi === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = previousApi;
    }
    Platform.OS = previousOs;
  });

  it("defaults web to same-origin /api", () => {
    Platform.OS = "web";
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(getApiBaseUrl()).toBe("/api");
  });

  it("normalizes hosted absolute origins to include /api", () => {
    Platform.OS = "web";
    process.env.EXPO_PUBLIC_API_URL = "https://app.manut.xyz";
    expect(getApiBaseUrl()).toBe("https://app.manut.xyz/api");
  });

  it("requires native absolute Worker /api base", () => {
    Platform.OS = "ios";
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(() => getApiBaseUrl()).toThrow(/EXPO_PUBLIC_API_URL/u);
  });

  it("accepts native HTTPS Worker origin and appends /api", () => {
    Platform.OS = "ios";
    process.env.EXPO_PUBLIC_API_URL =
      "https://manut-preview.bettergogocash.workers.dev";
    expect(getApiBaseUrl()).toBe(
      "https://manut-preview.bettergogocash.workers.dev/api",
    );
  });
});
