import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/providers/auth-provider";

// Authentication shell behaviour.
//
// Nothing here tests the authentication *architecture* — that lives in the API
// and was not touched this phase. These cover the presentation layer's
// contract: an unauthenticated visitor is bounced to sign-in with enough
// information to be returned afterwards, a permission-less visitor gets nothing
// rendered, and the guard never renders protected children while it is still
// deciding.

const push = vi.fn();
vi.mock("nextjs-toploader/app", () => ({ useRouter: () => ({ push }) }));

const notFound = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  notFound: () => {
    notFound();
    // Real `notFound()` throws to unwind; mimic that so the component stops.
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/providers/auth-provider", () => ({ useAuth: vi.fn() }));

const mockAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

function auth(overrides: Record<string, unknown> = {}) {
  mockAuth.mockReturnValue({
    user: { id: "u1", name: "Test", mustChangePassword: false },
    isAuthenticated: true,
    isLoading: false,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    ...overrides,
  });
}

beforeEach(() => {
  push.mockClear();
  notFound.mockClear();
  window.history.replaceState({}, "", "/projects");
});

describe("unauthenticated access", () => {
  it("sends the visitor to sign-in and parks where they were going", () => {
    auth({ isAuthenticated: false, user: null });
    render(
      <ProtectedRoute>
        <p>secret</p>
      </ProtectedRoute>,
    );

    expect(push).toHaveBeenCalledWith(
      `/sign-in?redirect=${encodeURIComponent("/projects")}`,
    );
    // And nothing protected is rendered on the way out.
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("keeps the query string, so a deep link returns to the right view", () => {
    // `/projects?view=pending` is what an approval email links to. Parking only
    // the pathname returned the user to the page with the wrong state.
    window.history.replaceState({}, "", "/projects?view=pending&id=42");
    auth({ isAuthenticated: false, user: null });
    render(
      <ProtectedRoute>
        <p>secret</p>
      </ProtectedRoute>,
    );

    const target = push.mock.calls[0]?.[0] as string;
    const parked = decodeURIComponent(
      new URL(target, "http://x").search.replace("?redirect=", ""),
    );
    expect(parked).toBe("/projects?view=pending&id=42");
  });
});

describe("while the session is still resolving", () => {
  it("renders neither the children nor a redirect", () => {
    auth({ isLoading: true, isAuthenticated: false, user: null });
    render(
      <ProtectedRoute>
        <p>secret</p>
      </ProtectedRoute>,
    );

    // Flashing protected content before the session resolves is a leak; and
    // bouncing to sign-in before it resolves logs people out on every refresh.
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("authenticated access", () => {
  it("renders the page when the session is good", () => {
    auth();
    render(
      <ProtectedRoute>
        <p>secret</p>
      </ProtectedRoute>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("diverts a forced password change before showing anything", () => {
    auth({ user: { id: "u1", mustChangePassword: true } });
    render(
      <ProtectedRoute>
        <p>secret</p>
      </ProtectedRoute>,
    );
    expect(push).toHaveBeenCalledWith("/change-password");
  });
});

describe("permission gating", () => {
  it("refuses a route the user lacks the permission for", () => {
    auth({ hasPermission: () => false });
    expect(() =>
      render(
        <ProtectedRoute requiredPermission="projects:read">
          <p>secret</p>
        </ProtectedRoute>,
      ),
    ).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("accepts any one of a permission union", () => {
    // Approval landing pages are reached by users holding `*:approve` but not
    // the plain `*:read` their sidebar entry is gated on.
    auth({
      hasAnyPermission: (...codes: string[]) => codes.includes("leave:approve"),
    });
    render(
      <ProtectedRoute requiredPermissions={["leave:read", "leave:approve"]}>
        <p>queue</p>
      </ProtectedRoute>,
    );
    expect(screen.getByText("queue")).toBeInTheDocument();
  });

  it("refuses when none of the union is held", () => {
    auth({ hasAnyPermission: () => false });
    expect(() =>
      render(
        <ProtectedRoute requiredPermissions={["leave:read", "leave:approve"]}>
          <p>queue</p>
        </ProtectedRoute>,
      ),
    ).toThrow("NEXT_NOT_FOUND");
  });

  // Front-end gating is convenience, not the boundary — the API enforces the
  // same codes. This records the intent so nobody later "optimises" the guard
  // away on the grounds that the server checks anyway.
  it("gates in the client as defence in depth, not as the only check", () => {
    auth({ hasPermission: () => false });
    expect(() =>
      render(
        <ProtectedRoute requiredPermission="payroll:read">
          <p>payslips</p>
        </ProtectedRoute>,
      ),
    ).toThrow();
  });
});
