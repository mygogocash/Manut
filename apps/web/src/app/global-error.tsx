"use client";

import { useEffect } from "react";

// Patterns we treat as "the user's tab is stuck on a stale deploy",
// which is the typical cause of  errors like
//   "Cannot read properties of undefined (reading 'call')"
// surfacing from inside `webpack-*.js`. The runtime tries to call a
// module factory whose chunk file no longer exists on the CDN because
// a new deploy rotated chunk hashes.
const STALE_CHUNK_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  // Generic webpack runtime tell — narrow enough to be safe (we only
  // hard-reload once via sessionStorage; harmless if the heuristic
  // matches a non-deploy error).
  /reading 'call'/i,
];

function looksLikeStaleDeploy(message: string): boolean {
  return STALE_CHUNK_PATTERNS.some((re) => re.test(message));
}

const RELOAD_FLAG = "intranet.global-error.auto-reload";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Auto-reload on stale-deploy chunk failures. Cap at one reload per
  // session via `sessionStorage` so a real bug doesn't trigger an
  // infinite refresh loop — second occurrence falls through to the
  // manual UI below.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const message = error?.message ?? "";
    if (!looksLikeStaleDeploy(message)) return;
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    // Bust any HTTP cache by appending a marker. Cleared after the
    // reload by `clearReloadFlag` below.
    const url = new URL(window.location.href);
    url.searchParams.set("__rl", String(Date.now()));
    window.location.replace(url.toString());
  }, [error]);

  // First mount after a successful auto-reload — clear the marker so a
  // future stale chunk gets one more shot.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("__rl")) {
      sessionStorage.removeItem(RELOAD_FLAG);
    }
  }, []);

  const stale = looksLikeStaleDeploy(error?.message ?? "");

  return (
    <html lang="en">
      <body
        className={`
          flex min-h-screen items-center justify-center bg-gray-50 font-sans
        `}
      >
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 text-5xl">{stale ? "↻" : "⚠"}</div>
          <h1 className="mb-2 text-2xl font-semibold text-gray-900">
            {stale ? "Reloading to a newer version" : "Something went wrong"}
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            {stale
              ? "A new version was deployed while this tab was open. We're refreshing it for you."
              : error.message || "An unexpected error occurred."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={reset}
              className={`
                rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium
                text-white transition
                hover:bg-blue-700
              `}
            >
              Try again
            </button>
            <button
              onClick={() => {
                if (typeof window === "undefined") return;
                sessionStorage.removeItem(RELOAD_FLAG);
                window.location.reload();
              }}
              className={`
                rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm
                font-medium text-gray-800 transition
                hover:bg-gray-100
              `}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
