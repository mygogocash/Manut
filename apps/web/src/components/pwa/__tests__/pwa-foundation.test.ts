import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// PWA foundation guards.
//
// The service worker cannot be unit-tested by importing it — it is a classic
// worker script that binds `self.addEventListener` at module scope and is served
// as a static asset, not a module. So it is exercised two ways:
//
//   - the manifest and metadata are asserted as data, because a malformed
//     manifest silently kills installability with no error anywhere;
//   - the worker's *decision functions* are extracted and run, because the
//     caching boundary is the security-critical part of this phase and a
//     regression there leaks payroll data into a cache on a shared device.
//
// What is NOT asserted here: that the browser registers the worker, caches the
// right things, and serves the offline page. That needs a real browser and is
// listed for CI in docs/pwa/PHASE_3_PWA_FOUNDATION.md.

const WEB_ROOT = join(__dirname, "..", "..", "..", "..");
const manifest = JSON.parse(
  readFileSync(join(WEB_ROOT, "public", "manifest.webmanifest"), "utf8"),
) as Record<string, unknown>;
const swSource = readFileSync(join(WEB_ROOT, "public", "sw.js"), "utf8");

/**
 * The worker with comments removed.
 *
 * Needed because this file documents its own decisions heavily — the install
 * handler explains *why* it does not call `skipWaiting()`, and the header names
 * the `push` handlers a later phase will add. Grepping raw source therefore
 * finds prose and reports it as code, which is how the first run of these tests
 * failed. Assertions about code shape run against this instead.
 */
const swCode = swSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/\/\/\/.*$/gm, "");

/* ── Manifest ──────────────────────────────────────────────────────── */

describe("web app manifest", () => {
  it("declares the fields a browser needs to offer installation", () => {
    for (const field of [
      "name",
      "short_name",
      "start_url",
      "scope",
      "display",
      "theme_color",
      "background_color",
      "icons",
    ]) {
      expect(manifest[field], `missing ${field}`).toBeDefined();
    }
  });

  // The product is branded "Manut" (CLAUDE.md #210); `@nexora/*` is a
  // workspace detail and must never reach a user's home screen.
  it("uses the real product name, not the workspace name", () => {
    expect(manifest.name).toBe("Manut — The Binary Holdings");
    expect(manifest.short_name).toBe("Manut");
    expect(JSON.stringify(manifest).toLowerCase()).not.toContain("nexora");
  });

  // A short_name over ~12 characters gets truncated under a launcher icon.
  it("keeps short_name short enough for a home screen", () => {
    expect((manifest.short_name as string).length).toBeLessThanOrEqual(12);
  });

  it("starts at the canonical root, not a mobile-specific route", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(JSON.stringify(manifest)).not.toContain("/mobile");
  });

  it("requests an app-like display with a graceful fallback chain", () => {
    expect(manifest.display).toBe("standalone");
    // If standalone is unsupported the browser walks this list rather than
    // failing to install.
    expect(manifest.display_override).toContain("browser");
  });

  it("ships the icon sizes Chrome requires, plus maskable variants", () => {
    const icons = manifest.icons as Array<{
      sizes: string;
      purpose: string;
      src: string;
      type: string;
    }>;
    const any = icons.filter((i) => i.purpose === "any");
    const maskable = icons.filter((i) => i.purpose === "maskable");

    // Chrome will not offer installation without a 192 and a 512.
    expect(any.map((i) => i.sizes)).toContain("192x192");
    expect(any.map((i) => i.sizes)).toContain("512x512");
    // Without a maskable icon Android shrinks the icon inside a white circle.
    expect(maskable.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.src.startsWith("/icons/")).toBe(true);
    }
  });

  it("uses colours that exist in the palette", () => {
    // --background and --surface, resolved. Not arbitrary hexes.
    expect(manifest.background_color).toBe("#f4f2ec");
    expect(manifest.theme_color).toBe("#ffffff");
  });
});

/* ── Icons on disk ─────────────────────────────────────────────────── */

describe("icon assets", () => {
  const icons = (
    manifest.icons as Array<{ src: string; sizes: string }>
  ).concat([{ src: "/icons/apple-touch-icon.png", sizes: "180x180" }]);

  it("every referenced icon exists and is a real PNG of the declared size", () => {
    for (const icon of icons) {
      const buf = readFileSync(join(WEB_ROOT, "public", icon.src));
      // PNG signature.
      expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      const [declared] = icon.sizes.split("x").map(Number);
      expect(width, `${icon.src} width`).toBe(declared);
      expect(height, `${icon.src} height`).toBe(declared);
    }
  });
});

/* ── Caching boundary ──────────────────────────────────────────────── */

/**
 * Lifts the worker's route predicates out of the script and evaluates them.
 *
 * Reading the source and re-evaluating keeps the test honest — it exercises the
 * shipped file rather than a copy that can drift.
 */
function loadPredicates() {
  const grab = (name: string) => {
    const start = swSource.indexOf(`function ${name}(`);
    if (start === -1) throw new Error(`${name} not found in sw.js`);
    // Walk braces to the end of the function body.
    let depth = 0;
    let i = swSource.indexOf("{", start);
    const from = i;
    for (; i < swSource.length; i++) {
      if (swSource[i] === "{") depth++;
      else if (swSource[i] === "}" && --depth === 0) break;
    }
    return `${swSource.slice(start, from)}${swSource.slice(from, i + 1)}`;
  };

  const factory = new Function(
    `${grab("isHashedStatic")}\n${grab("isNeverCacheable")}\nreturn { isHashedStatic, isNeverCacheable };`,
  );
  return factory() as {
    isHashedStatic: (url: URL) => boolean;
    isNeverCacheable: (url: URL) => boolean;
  };
}

const { isHashedStatic, isNeverCacheable } = loadPredicates();
const u = (path: string) => new URL(path, "https://intranet.example.com");

describe("the caching boundary", () => {
  // The single most important assertion in this phase. Every one of these
  // paths returns authenticated business data.
  it.each([
    "/api/auth/me",
    "/api/payroll/payslips",
    "/api/expenses",
    "/api/employees/123",
    "/api/messages/unread-count",
    "/api/dashboard/stats",
    "/api/proposals/abc",
    "/api/uploads/signed-url",
  ])("never caches %s", (path) => {
    expect(isNeverCacheable(u(path))).toBe(true);
    expect(isHashedStatic(u(path))).toBe(false);
  });

  it("never caches the analytics proxy or auth callbacks", () => {
    expect(isNeverCacheable(u("/ingest/decide"))).toBe(true);
    expect(isNeverCacheable(u("/auth/callback"))).toBe(true);
  });

  it("caches only content-addressed static assets", () => {
    expect(isHashedStatic(u("/_next/static/chunks/main-abc123.js"))).toBe(true);
    expect(isHashedStatic(u("/_next/static/css/abc.css"))).toBe(true);
    expect(isHashedStatic(u("/icons/icon-192.png"))).toBe(true);
    expect(isHashedStatic(u("/manifest.webmanifest"))).toBe(true);
  });

  // Authenticated HTML is as sensitive as the API payload that produced it.
  it.each(["/dashboard", "/payroll", "/hrms/esop/42", "/messages", "/"])(
    "does not treat the %s document as cacheable static",
    (path) => {
      expect(isHashedStatic(u(path))).toBe(false);
    },
  );

  it("does not cache Next's server-rendered data requests", () => {
    // Not hashed, so it falls through to the network by default.
    expect(isHashedStatic(u("/_next/data/build/dashboard.json"))).toBe(false);
  });
});

/* ── Worker behaviour, asserted from the source ────────────────────── */

describe("service worker contract", () => {
  it("passes non-GET requests straight through, so mutations are never queued", () => {
    // An approval replayed after reconnection could act on a record that has
    // since moved — the API uses conditional updates precisely because of that.
    expect(swCode).toContain('request.method !== "GET"');
    expect(swCode).not.toMatch(/backgroundSync|replayQueue|queueRequest/i);
  });

  it("does not take control without being asked", () => {
    // skipWaiting must only ever run from the message handler, so a deploy
    // cannot swap assets under someone mid-workflow.
    const occurrences = swCode.match(/skipWaiting\(\)/g) ?? [];
    expect(occurrences).toHaveLength(1);
    expect(swCode).toContain('event.data.type === "SKIP_WAITING"');
    // And it is not called from install or activate.
    const installBlock =
      /addEventListener\("install"[\s\S]*?addEventListener\("activate"/.exec(
        swCode,
      )?.[0] ?? "";
    expect(installBlock).not.toContain("skipWaiting");
  });

  it("versions its caches and cleans only its own", () => {
    expect(swCode).toMatch(/const SW_VERSION = "v\d+"/);
    expect(swCode).toContain('n.startsWith("tbh-")');
    expect(swCode).toContain("CURRENT_CACHES.includes(n)");
  });

  it("precaches the offline page and nothing authenticated", () => {
    expect(swCode).toContain('const OFFLINE_URL = "/offline"');
    // The shell list must not contain an application route.
    const shell = /const SHELL_ASSETS = \[([\s\S]*?)\]/.exec(swCode)?.[1] ?? "";
    for (const route of ["/dashboard", "/payroll", "/messages", "/hrms"]) {
      expect(shell).not.toContain(route);
    }
  });

  it("ignores cross-origin traffic", () => {
    expect(swCode).toContain("url.origin !== self.location.origin");
  });

  it("carries no secrets", () => {
    expect(swCode).not.toMatch(
      /api[_-]?key|secret|token|password|bearer|SUPABASE/i,
    );
  });

  // Phase 6 added push. These assert it was added *without* disturbing the
  // caching boundary above, which is the property that matters.
  it("handles push and notification clicks", () => {
    expect(swCode).toContain('addEventListener("push"');
    expect(swCode).toContain('addEventListener("notificationclick"');
  });

  it("still never caches an API response after the push handlers landed", () => {
    // The fetch rules are above the push section; this is a canary for someone
    // "tidying" the two together later.
    expect(swCode).toContain('url.pathname.startsWith("/api/")');
    expect(swCode).toContain("if (isNeverCacheable(url)) return;");
  });

  it("refuses to open anything but a same-origin path from a payload", () => {
    // A URL arriving in a push payload reaches `clients.openWindow()`. Without
    // this check that is an open redirect with a notification as the lure.
    expect(swCode).toContain("function safeTargetPath(");
    expect(swCode).toContain('value.startsWith("//")');
    expect(swCode).toContain("safeTargetPath(event.notification.data?.url)");
  });

  it("survives a malformed payload instead of throwing", () => {
    // A throw inside the push handler shows the browser's generic "site updated
    // in the background" notification, which is worse than a fallback.
    expect(swCode).toContain("function readPushPayload(");
    expect(swCode).toMatch(/catch\s*\{/);
  });

  it("reuses an open window rather than opening a second copy", () => {
    expect(swCode).toContain("clients.matchAll(");
    expect(swCode).toContain("client.focus()");
    expect(swCode).toContain("clients.openWindow(");
  });
});
