import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api-client";
import {
  disconnectGoogle,
  startGoogleOauth,
} from "@/services/integrations.service";

vi.mock("@/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe("integrations.service > startGoogleOauth", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.delete.mockReset();
  });

  it("given backend returns url > GETs /integrations/google/oauth-start and returns { url }", async () => {
    apiMock.get.mockResolvedValueOnce({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
    });

    const result = await startGoogleOauth();

    expect(apiMock.get).toHaveBeenCalledWith(
      "/integrations/google/oauth-start",
    );
    expect(result).toEqual({
      url: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
    });
  });
});

describe("integrations.service > disconnectGoogle", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.delete.mockReset();
  });

  it("given backend returns ok > DELETEs /integrations/google and returns { ok: true }", async () => {
    apiMock.delete.mockResolvedValueOnce({ data: { ok: true } });

    const result = await disconnectGoogle();

    expect(apiMock.delete).toHaveBeenCalledWith("/integrations/google");
    expect(result).toEqual({ ok: true });
  });
});
