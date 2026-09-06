import type { Metadata } from "next";

// The offline fallback, served by the service worker when a navigation fails.
//
// Deliberately a server component with NO client JavaScript and no data
// fetching. It is displayed precisely when the network is unavailable, so
// anything that needs a script or a request would render an empty screen — the
// page has to work from its cached HTML alone. That is also why "Try again" is
// a plain link rather than a button with an onClick.
//
// It states what is unavailable rather than implying the app is broken, and it
// never shows cached business data — see the caching boundary in
// docs/pwa/PHASE_3_PWA_FOUNDATION.md.

export const metadata: Metadata = {
  title: "Offline — Manut",
  // Nothing here is useful in a search index, and it should never be surfaced
  // as if it were a real page.
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main
      className={`
        bg-background text-foreground flex min-h-svh flex-col items-center
        justify-center px-6 py-12
      `}
    >
      <div className="w-full max-w-sm text-center">
        {/* Inline SVG, not an <img>: one less request to fail. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-muted-foreground mx-auto mb-5 size-10"
        >
          <path d="M2 8.82a15 15 0 0 1 20 0" />
          <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <path d="M12 20h.01" />
          <path d="m2 2 20 20" />
        </svg>

        <h1 className="text-lg font-semibold tracking-tight">You’re offline</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          Some information may be unavailable until you reconnect. Nothing you
          had already submitted has been lost.
        </p>

        {/* A plain anchor, not next/link, on purpose. `Link` does a
            client-side transition through the router — which needs the JS
            bundle this page exists precisely because the device cannot load.
            A full document navigation is also exactly the retry semantics we
            want: it re-attempts the network. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className={`
            bg-primary text-primary-foreground mt-6 inline-flex h-10
            items-center justify-center rounded-md px-5 text-sm font-medium
            focus-visible:ring-ring focus-visible:ring-2
            focus-visible:ring-offset-2 focus-visible:outline-none
            hover:opacity-90
          `}
        >
          Try again
        </a>

        <p className="text-muted-foreground mt-8 text-xs">
          The Manut needs a connection to show live data. Reconnect and this
          page will let you straight back in.
        </p>
      </div>
    </main>
  );
}
