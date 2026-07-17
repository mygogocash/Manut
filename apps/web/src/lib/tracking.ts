"use client";

import posthog, { type PostHog } from "posthog-js";

import { isPublicSigningPath } from "@/lib/public-signing-path";

/**
 * Single chokepoint for product analytics in the browser.
 *
 * Calls are no-ops outside production unless NEXT_PUBLIC_TELEMETRY_ENABLED=1.
 * Init is lazy — the first identify/group/capture triggers it.
 *
 * See .telemetry/implementation-guide.md for the wiring contract.
 */

const isEnabled =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === "1";

let initialized = false;

function pathFromUrl(value: string): string | null {
  try {
    return new URL(value, "https://manut.invalid").pathname;
  } catch {
    return null;
  }
}

function containsSigningReference(value: string): boolean {
  let candidate = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const pathname = pathFromUrl(candidate);
    if (pathname && isPublicSigningPath(pathname)) return true;
    if (/\/sign\/[^/?#&]+/i.test(candidate)) return true;

    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
    } catch {
      break;
    }
  }
  return false;
}

function sanitizeAnalyticsUrl(value: string): string {
  const pathname = pathFromUrl(value);
  if (!containsSigningReference(value)) return value;
  try {
    const url = new URL(value, window.location.origin);
    if (pathname && isPublicSigningPath(pathname)) {
      url.pathname = "/sign/redacted";
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "/sign/redacted";
  }
}

function eventContainsSigningUrl(properties: Record<string, unknown>): boolean {
  return Object.entries(properties).some(([key, value]) => {
    if (typeof value !== "string") return false;
    if (!/(?:url|pathname|referrer)/i.test(key)) return false;
    return containsSigningReference(value);
  });
}

function init(): PostHog | null {
  if (!isEnabled) return null;
  if (typeof window === "undefined") return null;
  if (containsSigningReference(window.location.href)) return null;
  if (initialized) return posthog;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[tracking] PostHog disabled — missing key or host");
    }
    return null;
  }

  posthog.init(key, {
    api_host: host,
    defaults: "2026-01-30",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    // A /sign/:token path contains the sole bearer credential for a legally
    // meaningful action. Never initialize on that route, and also guard an
    // already-initialized SPA instance from history/pageleave capture.
    get_current_url: sanitizeAnalyticsUrl,
    before_send: (event) => {
      if (!event) return null;
      if (containsSigningReference(window.location.href)) return null;
      if (eventContainsSigningUrl(event.properties ?? {})) return null;
      return event;
    },
    // The dashboard scroll lives on an inner `<div data-ph-scroll-root>`
    // (see `app/(dashboard)/layout.tsx`), not the document — PostHog
    // defaults to `html` and would never see scroll events. Pointing
    // it at the real scroll container lets `$pageleave` carry the
    // `$prev_pageview_max_scroll` properties the Health check looks for.
    scroll_root_selector: ["[data-ph-scroll-root]", "html"],
    loaded: (ph) => {
      if (process.env.NODE_ENV !== "production") {
        ph.debug();
      }
    },
  });

  initialized = true;
  return posthog;
}

type Traits = Record<string, unknown>;

/**
 * `properties?: object` rather than `Traits` so per-event interfaces
 * (CourseStartedProps, etc.) satisfy the parameter without an explicit
 * `[key: string]: unknown` index signature on every interface.
 */
export const tracking = {
  identify(userId: string, traits: Traits & { $set_once?: Traits }): void {
    const ph = init();
    if (!ph) return;
    const { $set_once, ...$set } = traits;
    ph.identify(userId, $set, $set_once);
  },

  group(type: "entity", key: string, traits: object): void {
    const ph = init();
    if (!ph) return;
    ph.group(type, key, traits as Traits);
  },

  capture(event: string, properties?: object): void {
    const ph = init();
    if (!ph) return;
    ph.capture(event, properties as Traits);
  },

  reset(): void {
    const ph = init();
    if (!ph) return;
    ph.reset();
  },
};
