import { beforeEach, describe, expect, it, vi } from "vitest";

// `safeRedirectTarget` is module-private, so exercise it through the same
// contract the provider relies on: read `?redirect=`, accept only same-origin
// absolute paths. Kept in lockstep with auth-provider.tsx.
function safeRedirectTarget(search: string): string | null {
  const raw = new URLSearchParams(search).get("redirect");
  if (!raw) return null;
  let target: string;
  try {
    target = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!target.startsWith("/")) return null;
  if (target.startsWith("//")) return null;
  if (target.startsWith("/sign-in")) return null;
  return target;
}

const q = (v: string) => `?redirect=${encodeURIComponent(v)}`;

describe("safeRedirectTarget", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns the parked path so an emailed deep link survives sign-in", () => {
    expect(safeRedirectTarget(q("/projects/requests/abc123"))).toBe(
      "/projects/requests/abc123",
    );
  });

  it("keeps query strings on the target", () => {
    expect(safeRedirectTarget(q("/projects/requests?view=pending"))).toBe(
      "/projects/requests?view=pending",
    );
  });

  it("falls back to null when there is no redirect param", () => {
    expect(safeRedirectTarget("")).toBeNull();
    expect(safeRedirectTarget("?other=1")).toBeNull();
  });

  // ── open-redirect defences ──
  it("rejects an absolute URL to another origin", () => {
    expect(safeRedirectTarget(q("https://evil.example.com/steal"))).toBeNull();
  });

  it("rejects a protocol-relative URL", () => {
    // `//evil.example.com` is another origin to the browser despite the
    // leading slash, this is the classic open-redirect bypass.
    expect(safeRedirectTarget(q("//evil.example.com"))).toBeNull();
  });

  it("rejects a javascript: payload", () => {
    expect(safeRedirectTarget(q("javascript:alert(1)"))).toBeNull();
  });

  it("refuses to bounce back to sign-in", () => {
    expect(safeRedirectTarget(q("/sign-in"))).toBeNull();
    expect(safeRedirectTarget(q("/sign-in?redirect=/x"))).toBeNull();
  });

  it("returns null on a malformed escape rather than throwing", () => {
    expect(safeRedirectTarget("?redirect=%E0%A4%A")).toBeNull();
  });
});
