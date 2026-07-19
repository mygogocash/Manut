import type {
  AuthGateway,
  AuthSession,
  SessionTransport,
  TransportRequest,
  TransportResponse,
} from "@manut/app-core";

import { createPlatformAuthGateway } from "@/platform/auth-gateway.web";

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

const mockExecute = jest.fn<Promise<TransportResponse>, [TransportRequest]>();
const mockClear = jest.fn(async () => undefined);
const mockTransport: SessionTransport = {
  async decorate(request) {
    return {
      ...request,
      credentials: "include",
    };
  },
  refresh: jest.fn(async () => false),
  clear: () => mockClear(),
};

jest.mock("@/platform/api-config", () => ({
  getApiBaseUrl: () => "/api",
}));

jest.mock("@/platform/http-executor", () => ({
  fetchExecutor: (request: TransportRequest) => mockExecute(request),
}));

jest.mock("@/platform/session-transport.web", () => ({
  createSessionTransport: () => mockTransport,
}));

describe("web auth gateway adapter", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockClear.mockReset();
    mockClear.mockResolvedValue(undefined);
    mockExecute.mockResolvedValue({
      status: 200,
      body: SESSION,
    });
  });

  it("implements the AuthGateway port with password login preserved", async () => {
    const gateway: AuthGateway = createPlatformAuthGateway();

    await expect(
      gateway.login("  person@example.invalid  ", "password"),
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
  });

  it("clears the cookie session on logout after posting /auth/logout", async () => {
    mockExecute.mockResolvedValue({
      status: 200,
      body: { success: true },
    });
    const gateway = createPlatformAuthGateway();

    await gateway.logout();

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/auth/logout",
        method: "POST",
      }),
    );
    expect(mockClear).toHaveBeenCalled();
  });

  it("keeps magic-link and password-reset on the auth-link / password ports", async () => {
    mockExecute.mockResolvedValue({
      status: 200,
      body: { success: true, message: "Request accepted." },
    });
    const gateway = createPlatformAuthGateway();

    await expect(
      gateway.requestMagicLink("person@example.invalid"),
    ).resolves.toEqual({
      success: true,
      message: "Request accepted.",
    });
    await expect(
      gateway.requestPasswordReset("person@example.invalid"),
    ).resolves.toEqual({
      success: true,
      message: "Request accepted.",
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/api/auth/magic-link" }),
    );
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/api/auth/forgot-password" }),
    );
  });
});
