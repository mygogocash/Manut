import type {
  AuthSession,
  SessionTransport,
  TransportRequest,
  TransportResponse,
} from "@manut/app-core";

import { createPlatformAuthGateway } from "@/platform/auth-gateway.native";

const SESSION: AuthSession = {
  user: {
    id: "user-id",
    email: "person@example.invalid",
    name: "Person",
    avatarUrl: null,
    department: null,
    jobTitle: null,
    entity: null,
    mustChangePassword: false,
  },
  roles: [{ id: "role-id", name: "Employee", defaultRoute: null }],
  permissions: ["performance:read"],
};

const mockSetSession = jest.fn();
const mockSignOut = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockNativeClient = {
  auth: {
    setSession: mockSetSession,
    signOut: mockSignOut,
    signInWithPassword: mockSignInWithPassword,
  },
};
const mockExecute = jest.fn<Promise<TransportResponse>, [TransportRequest]>();
const mockTransport: SessionTransport = {
  async decorate(request) {
    return {
      ...request,
      headers: { ...request.headers, Authorization: "Bearer stored-token" },
      credentials: "omit",
    };
  },
  refresh: jest.fn(async () => false),
  clear: jest.fn(async () => undefined),
};

jest.mock("@/platform/api-config", () => ({
  getApiBaseUrl: () => "/api",
}));

jest.mock("@/platform/http-executor", () => ({
  fetchExecutor: (request: TransportRequest) => mockExecute(request),
}));

jest.mock("@/platform/session-transport.native", () => ({
  createSessionTransport: () => mockTransport,
  getNativeSupabaseClient: () => mockNativeClient,
}));

describe("native auth gateway", () => {
  beforeEach(() => {
    mockSetSession.mockReset();
    mockSignOut.mockReset();
    mockSignInWithPassword.mockReset();
    mockExecute.mockReset();
    mockSetSession.mockResolvedValue({
      data: { session: { access_token: "stored-token" } },
      error: null,
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockExecute.mockResolvedValue({ status: 200, body: SESSION });
  });

  it("persists link tokens before verifying the user through bearer /auth/me", async () => {
    const gateway = createPlatformAuthGateway();

    await expect(
      gateway.exchangeSession({
        accessToken: "link-access-token",
        refreshToken: "link-refresh-token",
      }),
    ).resolves.toEqual(SESSION);

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "link-access-token",
      refresh_token: "link-refresh-token",
    });
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/auth/me",
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer stored-token",
        }),
        credentials: "omit",
      }),
    );
  });

  it("clears the local link session when server verification rejects it", async () => {
    mockExecute.mockResolvedValue({
      status: 403,
      body: { error: { code: "FORBIDDEN", message: "Account unavailable" } },
    });
    const gateway = createPlatformAuthGateway();

    await expect(
      gateway.exchangeSession({
        accessToken: "link-access-token",
        refreshToken: "link-refresh-token",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("clears a password session when /auth/me rejects the native user", async () => {
    mockExecute.mockResolvedValue({
      status: 403,
      body: { error: { code: "FORBIDDEN", message: "Account unavailable" } },
    });
    const gateway = createPlatformAuthGateway();

    await expect(
      gateway.login("person@example.invalid", "password"),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "person@example.invalid",
      password: "password",
    });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
