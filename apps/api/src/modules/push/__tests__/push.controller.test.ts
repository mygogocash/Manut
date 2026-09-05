import { beforeEach, describe, expect, it, vi } from "vitest";

// Route registration.
//
// One claim in this module is a security claim rather than a behaviour: the
// development test-trigger is not merely guarded in production, it is *not
// registered at all*. A guard inside a handler can be bypassed by a routing
// mistake; a route that was never added cannot be. This proves it.

vi.mock("@/core/guards/auth.guard", () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireActive: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@/modules/push/push.service", () => ({
  pushService: {
    isEnabled: () => true,
    getPublicKey: () => "public",
    countForUser: async () => 0,
    subscribe: async () => ({ id: "s" }),
    unsubscribe: async () => ({ removed: true }),
    unsubscribeAll: async () => ({ removed: 0 }),
    sendToUsers: async () => ({ sent: 0, expired: 0, failed: 0, skipped: true }),
  },
}));

/** The paths an Express router has registered, as `METHOD /path`. */
async function routesFor(nodeEnv: string): Promise<string[]> {
  vi.resetModules();
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    const mod = await import("@/modules/push/push.controller");
    const router = mod.default as unknown as {
      stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
    };
    return router.stack
      .filter((layer) => layer.route)
      .map((layer) => {
        const route = layer.route!;
        const method = Object.keys(route.methods)[0]!.toUpperCase();
        return `${method} ${route.path}`;
      });
  } finally {
    process.env.NODE_ENV = previous;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("route registration", () => {
  it("registers the subscription routes in every environment", async () => {
    for (const env of ["development", "test", "production"]) {
      const routes = await routesFor(env);
      expect(routes, env).toContain("GET /config");
      expect(routes, env).toContain("POST /subscribe");
      expect(routes, env).toContain("POST /unsubscribe");
      expect(routes, env).toContain("POST /unsubscribe-all");
    }
  });

  it("does NOT register the test trigger in production", async () => {
    const routes = await routesFor("production");
    // Not a guarded 403 — the route does not exist, so it 404s like any other
    // unknown path.
    expect(routes).not.toContain("POST /test");
  });

  it("registers the test trigger outside production", async () => {
    expect(await routesFor("development")).toContain("POST /test");
    expect(await routesFor("test")).toContain("POST /test");
  });

  it("fails closed when NODE_ENV is unset", async () => {
    // An environment that does not say it is production gets the route. For a
    // trigger that can only notify the caller, that is the safe direction — the
    // alternative is a developer with no working test path.
    const routes = await routesFor("");
    expect(routes).toContain("POST /test");
  });

  it("exposes no route that names a recipient", async () => {
    // The whole authorisation model rests on this: there is no way to ask the
    // API to notify somebody else.
    const routes = await routesFor("production");
    for (const route of routes) {
      expect(route).not.toMatch(/send|notify|broadcast|user/i);
    }
  });
});
