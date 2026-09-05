"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Registers the service worker and owns the update handshake.
//
// Two decisions worth stating:
//
// 1. PRODUCTION ONLY. In development, Turbopack serves modules that change on
//    every keystroke; a worker caching them produces stale-asset bugs that look
//    like application bugs and cost an afternoon each. `next dev` therefore
//    gets no worker — and any worker left over from a production build on the
//    same origin (localhost) is actively unregistered, because that stale
//    registration outlives the build that created it.
//
// 2. THE USER DECIDES WHEN TO UPDATE. The worker never calls skipWaiting on its
//    own, so a deploy cannot swap the asset set under someone half-way through
//    a leave request. When a new version is waiting we offer a reload and take
//    it only when accepted.
//
// Everything here is behind capability checks: if `serviceWorker` is missing —
// Firefox in a private window, an older browser, a non-secure origin — the app
// carries on exactly as it does today. Nothing in the intranet depends on it.

/** Set by the reload we trigger ourselves, so we never loop. */
let reloading = false;

export function ServiceWorkerManager() {
  const promptedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Development: tear down anything a production build left behind.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => void reg.unregister());
      });
      return;
    }

    const offerUpdate = (worker: ServiceWorker) => {
      // Once per page life. A user who dismisses the prompt should not be
      // nagged every time the browser re-checks the worker.
      if (promptedRef.current) return;
      promptedRef.current = true;

      toast("A new version is available", {
        description: "Reload to get the latest changes.",
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            // The worker calls skipWaiting; `controllerchange` below reloads.
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    let registration: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;

        // A worker was already waiting when this page loaded.
        if (reg.waiting && navigator.serviceWorker.controller) {
          offerUpdate(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // `controller` distinguishes an update from the very first install.
            // On a first install there is nothing to reload into, and prompting
            // would be baffling.
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              offerUpdate(installing);
            }
          });
        });
      })
      .catch(() => {
        // Registration can fail legitimately — an insecure origin, a blocked
        // worker, storage denied. Swallow it: the app is fully usable without.
      });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      void registration;
    };
  }, []);

  return null;
}
