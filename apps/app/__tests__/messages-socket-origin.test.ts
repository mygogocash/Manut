import { getMessagesSocketUrl } from "@/platform/messages-socket-origin";

describe("getMessagesSocketUrl", () => {
  const previousSocket = process.env.EXPO_PUBLIC_SOCKET_URL;
  const previousApi = process.env.EXPO_PUBLIC_API_URL;
  const previousOs = process.env.EXPO_OS;

  afterEach(() => {
    if (previousSocket === undefined) {
      delete process.env.EXPO_PUBLIC_SOCKET_URL;
    } else {
      process.env.EXPO_PUBLIC_SOCKET_URL = previousSocket;
    }
    if (previousApi === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = previousApi;
    }
    if (previousOs === undefined) {
      delete process.env.EXPO_OS;
    } else {
      process.env.EXPO_OS = previousOs;
    }
  });

  it("prefers EXPO_PUBLIC_SOCKET_URL and appends /messages when needed", () => {
    process.env.EXPO_PUBLIC_SOCKET_URL = "https://api.example.invalid";
    expect(getMessagesSocketUrl()).toBe("https://api.example.invalid/messages");
  });

  it("derives the namespace from EXPO_PUBLIC_API_URL", () => {
    delete process.env.EXPO_PUBLIC_SOCKET_URL;
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.invalid/api";
    expect(getMessagesSocketUrl()).toBe("https://api.example.invalid/messages");
  });

  it("uses same-origin /messages when API base is relative", () => {
    delete process.env.EXPO_PUBLIC_SOCKET_URL;
    process.env.EXPO_PUBLIC_API_URL = "/api";
    expect(getMessagesSocketUrl()).toBe("/messages");
  });
});
