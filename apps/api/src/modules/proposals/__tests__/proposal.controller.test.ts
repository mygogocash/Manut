import type { Router } from "express";
import { describe, expect, it, vi } from "vitest";

import router from "@/modules/proposals/proposal.controller";

// The router is imported for its middleware stack, so nothing it reaches at
// module load may touch a database or an email service. Vitest hoists these
// above the import regardless of where they sit in the file.
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: {} }));
vi.mock("@/infrastructure/email/email.service", () => ({
  deliverEmail: vi.fn(),
}));

// Route wiring, not behaviour.
//
// This file exists because of a real defect: the router was mounted without
// `authenticate`, so every request arrived with no `req.user` and was refused as
// UNAUTHENTICATED. A 401 is not a 403 to the web client — it treats one as an
// expired session and redirects to sign-in, so the page appeared to log the user
// out instead of telling them they lacked access.

/** Middleware names on the router itself, before any route matches. */
function routerLevelMiddleware(r: Router): string[] {
  return (
    r as unknown as {
      stack: Array<{ name: string; route?: unknown }>;
    }
  ).stack
    .filter((layer) => !layer.route)
    .map((layer) => layer.name);
}

interface RouteLayer {
  route?: { path: string; stack: Array<{ name: string }> };
}

function routes(r: Router): Array<{ path: string; handlers: string[] }> {
  return (r as unknown as { stack: RouteLayer[] }).stack
    .filter((layer): layer is Required<RouteLayer> => Boolean(layer.route))
    .map((layer) => ({
      path: layer.route.path,
      handlers: layer.route.stack.map((s) => s.name),
    }));
}

describe("proposals router wiring", () => {
  it("authenticates before any route is reached", () => {
    expect(routerLevelMiddleware(router)).toContain("authenticate");
  });

  it("rejects a deactivated account at the router level", () => {
    expect(routerLevelMiddleware(router)).toContain("requireActive");
  });

  it("gates every route with a permission check", () => {
    const ungated = routes(router).filter(
      (r) => !r.handlers.some((h) => h.includes("requirePermission")),
    );
    expect(ungated).toEqual([]);
  });

  // Express matches in declaration order, so a literal declared after `/:id`
  // is unreachable: `/settings` would be read as an id.
  it("declares every literal path before /:id", () => {
    const paths = routes(router).map((r) => r.path);
    const firstParam = paths.findIndex((p) => p.startsWith("/:"));
    const literalsAfter = paths
      .slice(firstParam + 1)
      .filter((p) => !p.startsWith("/:") && p !== "/");
    expect(literalsAfter).toEqual([]);
  });
});
