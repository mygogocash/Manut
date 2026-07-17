import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { AuthProvider, useAuth } from "@/providers/auth-provider";

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard",
  router: { push: vi.fn(), replace: vi.fn() },
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  identify: vi.fn(),
  group: vi.fn(),
  reset: vi.fn(),
  trackSessionStarted: vi.fn(),
  trackSessionEnded: vi.fn(),
}));

vi.mock("nextjs-toploader/app", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/services/auth.service", () => ({
  getMe: mocks.getMe,
  login: mocks.login,
  logout: mocks.logout,
  refreshSession: mocks.refreshSession,
}));

vi.mock("@/lib/tracking", () => ({
  tracking: {
    identify: mocks.identify,
    group: mocks.group,
    reset: mocks.reset,
  },
}));

vi.mock("@/lib/events", () => ({
  trackSessionStarted: mocks.trackSessionStarted,
  trackSessionEnded: mocks.trackSessionEnded,
}));

const ADMIN_SESSION = {
  user: {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin User",
    avatarUrl: null,
    department: "Operations",
    jobTitle: "Administrator",
    entity: null,
    mustChangePassword: false,
  },
  roles: [{ id: "role-1", name: "Admin", defaultRoute: null }],
  permissions: ["home:read"],
};

let currentAuth: ReturnType<typeof useAuth>;

function AuthProbe() {
  currentAuth = useAuth();
  return (
    <div>
      <span data-testid="authenticated">
        {String(currentAuth.isAuthenticated)}
      </span>
      <span data-testid="user-id">{currentAuth.user?.id ?? "none"}</span>
      <span data-testid="verification-error">
        {currentAuth.sessionVerificationError?.code ?? "none"}
      </span>
      <span data-testid="loading">{String(currentAuth.isLoading)}</span>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  mocks.pathname = "/dashboard";
  window.history.replaceState({}, "", "/dashboard");
  mocks.getMe.mockReset();
  mocks.login.mockReset();
  mocks.logout.mockReset().mockResolvedValue(undefined);
  mocks.refreshSession.mockReset().mockResolvedValue({ success: true });
});

describe("AuthProvider session verification", () => {
  it("does not bootstrap a private session on the public signing page", async () => {
    mocks.pathname = "/sign/secret-signing-token";
    window.history.replaceState({}, "", mocks.pathname);
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it.each([
    [0, "NETWORK_ERROR"],
    [429, "RATE_LIMITED"],
    [503, "VERIFICATION_FAILED"],
  ] as const)(
    "preserves a warm identity after status %s",
    async (status, expectedCode) => {
      mocks.getMe.mockResolvedValueOnce(ADMIN_SESSION);
      renderProvider();

      await screen.findByText("admin-1");
      mocks.getMe.mockRejectedValueOnce(
        new ApiError(status, "VERIFY_FAILED", "verification failed"),
      );

      await act(async () => {
        await currentAuth.refreshUser();
      });

      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("user-id")).toHaveTextContent("admin-1");
      expect(screen.getByTestId("verification-error")).toHaveTextContent(
        expectedCode,
      );
      expect(mocks.reset).not.toHaveBeenCalled();
    },
  );

  it("blocks a cold start on a retryable error and recovers on retry", async () => {
    mocks.getMe.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "offline"),
    );
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("verification-error")).toHaveTextContent(
        "NETWORK_ERROR",
      );
    });
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user-id")).toHaveTextContent("none");

    mocks.getMe.mockResolvedValueOnce(ADMIN_SESSION);
    await act(async () => {
      await currentAuth.refreshUser();
    });

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("verification-error")).toHaveTextContent("none");
  });

  it.each([401, 403])(
    "clears identity for terminal status %s",
    async (status) => {
      mocks.getMe.mockResolvedValueOnce(ADMIN_SESSION);
      renderProvider();
      await screen.findByText("admin-1");

      mocks.getMe.mockRejectedValueOnce(
        new ApiError(status, "AUTH_FAILED", "session expired"),
      );
      await act(async () => {
        await currentAuth.refreshUser();
      });

      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(screen.getByTestId("user-id")).toHaveTextContent("none");
      expect(screen.getByTestId("verification-error")).toHaveTextContent(
        "none",
      );
      expect(mocks.reset).toHaveBeenCalled();
    },
  );
});

describe("AuthProvider login routing", () => {
  it("uses router.replace with a validated deep link", async () => {
    mocks.getMe.mockResolvedValueOnce(ADMIN_SESSION);
    mocks.login.mockResolvedValueOnce(ADMIN_SESSION);
    renderProvider();
    await screen.findByText("admin-1");

    await act(async () => {
      await currentAuth.login(
        "admin@example.com",
        "correct horse battery staple",
        "/leave?tab=mine",
      );
    });

    expect(mocks.router.replace).toHaveBeenCalledWith("/leave?tab=mine");
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("gives password change precedence over the return path", async () => {
    mocks.getMe.mockResolvedValueOnce(ADMIN_SESSION);
    mocks.login.mockResolvedValueOnce({
      ...ADMIN_SESSION,
      user: { ...ADMIN_SESSION.user, mustChangePassword: true },
    });
    renderProvider();
    await screen.findByText("admin-1");

    await act(async () => {
      await currentAuth.login(
        "admin@example.com",
        "correct horse battery staple",
        "/leave?tab=mine",
      );
    });

    expect(mocks.router.replace).toHaveBeenCalledWith("/change-password");
  });
});
