import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/components/auth/protected-route";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  refreshUser: vi.fn(),
  pathname: "/leave",
  query: "tab=mine&page=2",
  auth: {
    user: null as { mustChangePassword: boolean } | null,
    isAuthenticated: false,
    isLoading: false,
    sessionVerificationError: null as {
      code: string;
      message: string;
      retryable: true;
    } | null,
    hasPermission: vi.fn(() => true),
    hasAnyPermission: vi.fn(() => true),
  },
}));

vi.mock("nextjs-toploader/app", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.query),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ ...mocks.auth, refreshUser: mocks.refreshUser }),
}));

beforeEach(() => {
  mocks.auth.user = null;
  mocks.auth.isAuthenticated = false;
  mocks.auth.isLoading = false;
  mocks.auth.sessionVerificationError = null;
  mocks.pathname = "/leave";
  mocks.query = "tab=mine&page=2";
});

describe("ProtectedRoute", () => {
  it("shows a retry panel without protected content after cold-start failure", () => {
    mocks.auth.sessionVerificationError = {
      code: "NETWORK_ERROR",
      message: "Check your connection and retry.",
      retryable: true,
    };

    render(
      <ProtectedRoute>
        <div>Protected payroll</div>
      </ProtectedRoute>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Session check unavailable",
    );
    expect(screen.queryByText("Protected payroll")).not.toBeInTheDocument();
    expect(mocks.router.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refreshUser).toHaveBeenCalledOnce();
  });

  it("redirects an anonymous session with the complete query string", async () => {
    render(
      <ProtectedRoute>
        <div>Protected payroll</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(mocks.router.replace).toHaveBeenCalledWith(
        "/sign-in?returnTo=%2Fleave%3Ftab%3Dmine%26page%3D2",
      );
    });
    expect(screen.queryByText("Protected payroll")).not.toBeInTheDocument();
  });

  it("keeps warm authenticated content mounted during a transient failure", () => {
    mocks.auth.user = { mustChangePassword: false };
    mocks.auth.isAuthenticated = true;
    mocks.auth.sessionVerificationError = {
      code: "RATE_LIMITED",
      message: "Retry later.",
      retryable: true,
    };

    render(
      <ProtectedRoute>
        <div>Protected payroll</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Protected payroll")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
