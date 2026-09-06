import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomepageSessionRouter } from "@/components/landing/homepage-session-router";
import { useAuth } from "@/providers/auth-provider";

const replace = vi.fn();
const push = vi.fn();

vi.mock("nextjs-toploader/app", () => ({
  useRouter: () => ({ replace, push }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: vi.fn(),
}));

const mockAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

describe("HomepageSessionRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not redirect when auth state is still loading", () => {
    mockAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      isEmployeeOnly: false,
    });

    render(<HomepageSessionRouter />);
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("does not redirect when visitor is unauthenticated (stays on '/')", () => {
    mockAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      isEmployeeOnly: false,
    });

    render(<HomepageSessionRouter />);
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to /change-password using replacement navigation when user must change password", () => {
    mockAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: "u1", email: "staff@example.com", mustChangePassword: true },
      isEmployeeOnly: false,
    });

    render(<HomepageSessionRouter />);
    expect(replace).toHaveBeenCalledWith("/change-password");
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to /my-portal using replacement navigation when user is employee-only", () => {
    mockAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: "u2", email: "emp@example.com", mustChangePassword: false },
      isEmployeeOnly: true,
    });

    render(<HomepageSessionRouter />);
    expect(replace).toHaveBeenCalledWith("/my-portal");
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard using replacement navigation for standard staff/admin users", () => {
    mockAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: "u3", email: "admin@example.com", mustChangePassword: false },
      isEmployeeOnly: false,
    });

    render(<HomepageSessionRouter />);
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(push).not.toHaveBeenCalled();
  });
});
