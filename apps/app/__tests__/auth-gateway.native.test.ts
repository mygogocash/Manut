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

const mockPersistNativeSession = jest.fn();
const mockClearNativeSession = jest.fn();
const mockExecute = jest.fn<Promise<TransportResponse>, [TransportRequest]>();
const mockTransport: SessionTransport = {
  async decorate(request) {
    return {
      ...request,
      headers: {
        ...request.headers,
        Authorization: "Bearer stored-token",
        "X-Manut-Client": "native",
      },
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
  persistNativeSession: (...args: unknown[]) =>
    mockPersistNativeSession(...args),
  clearNativeSession: (...args: unknown[]) => mockClearNativeSession(...args),
}));

describe("native auth gateway", () => {
  beforeEach(() => {
    mockPersistNativeSession.mockReset();
    mockClearNativeSession.mockReset();
    mockExecute.mockReset();
    mockPersistNativeSession.mockResolvedValue(undefined);
    mockClearNativeSession.mockResolvedValue(undefined);
    mockExecute.mockResolvedValue({
      status: 200,
      body: {
        ...SESSION,
        session: {
          accessToken: "link-access-token",
          refreshToken: "link-refresh-token",
          expiresIn: 3600,
        },
      },
    });
  });

  it("logs in through Manut /auth/login and persists bearer tokens", async () => {
    const gateway = createPlatformAuthGateway();

    await expect(
      gateway.login("person@example.invalid", "password"),
    ).resolves.toEqual(SESSION);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/auth/login",
        method: "POST",
        body: {
          email: "person@example.invalid",
          password: "password",
        },
      }),
    );
    expect(mockPersistNativeSession).toHaveBeenCalledWith({
      accessToken: "link-access-token",
      refreshToken: "link-refresh-token",
    });
  });

  it("persists exchanged link tokens before verifying the user", async () => {
    const gateway = createPlatformAuthGateway();

    await expect(
      gateway.exchangeSession({
        accessToken: "link-access-token",
        refreshToken: "link-refresh-token",
      }),
    ).resolves.toEqual(SESSION);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/auth/exchange-session",
        method: "POST",
        body: {
          accessToken: "link-access-token",
          refreshToken: "link-refresh-token",
        },
      }),
    );
    expect(mockPersistNativeSession).toHaveBeenCalledWith({
      accessToken: "link-access-token",
      refreshToken: "link-refresh-token",
    });
  });

  it("clears the local session when server verification rejects login", async () => {
    mockExecute.mockResolvedValue({
      status: 403,
      body: { error: { code: "FORBIDDEN", message: "Account unavailable" } },
    });
    const gateway = createPlatformAuthGateway();

    await expect(
      gateway.login("person@example.invalid", "password"),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockClearNativeSession).toHaveBeenCalled();
  });

  it("fails closed when native login omits bearer session tokens", async () => {
    mockExecute.mockResolvedValue({
      status: 200,
      body: SESSION,
    });
    const gateway = createPlatformAuthGateway();

    await expect(
      gateway.login("person@example.invalid", "password"),
    ).rejects.toMatchObject({
      code: "NATIVE_SESSION_UNAVAILABLE",
      status: 503,
    });
    expect(mockClearNativeSession).toHaveBeenCalled();
  });
});
