import { describe, expect, it, vi } from "vitest";

import { ApiClient } from "../src/api/api-client";
import type { SessionTransport } from "../src/api/api-types";

function session(): SessionTransport {
  return {
    async decorate(request) {
      return {
        ...request,
        headers: { ...request.headers, Authorization: "Bearer private-token" },
      };
    },
    async refresh() {
      return false;
    },
    async clear() {},
  };
}

describe("ApiClient request boundaries", () => {
  it.each(["https://attacker.example/path", "//attacker.example/path"])(
    "rejects off-origin API path %s before session decoration",
    async (path) => {
      const execute = vi.fn();
      const client = new ApiClient({
        baseUrl: "https://api.example.invalid/api",
        execute,
        session: session(),
      });

      await expect(client.get(path)).rejects.toMatchObject({
        code: "INVALID_API_PATH",
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it("builds an application-relative path against the configured API base", async () => {
    const execute = vi.fn().mockResolvedValue({
      status: 200,
      body: { success: true },
    });
    const client = new ApiClient({
      baseUrl: "https://api.example.invalid/api/",
      execute,
      session: session(),
    });

    await expect(client.get("/auth/me")).resolves.toEqual({ success: true });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://api.example.invalid/api/auth/me",
        headers: expect.objectContaining({
          Authorization: "Bearer private-token",
        }),
      }),
    );
  });

  it("preserves a caller cancellation signal through session decoration", async () => {
    const signal = { aborted: false };
    const execute = vi.fn().mockResolvedValue({ status: 200, body: [] });
    const client = new ApiClient({
      baseUrl: "/api",
      execute,
      session: session(),
    });

    await client.get("/directory", { signal });

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ signal }));
  });
});
