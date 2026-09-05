"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/hooks/use-push-subscription";

// The notification opt-in row, shown at the foot of the notification bell.
//
// Placed there rather than buried in Settings because that is where somebody
// looks when they wonder why they missed something. It renders nothing at all
// when the browser cannot do push or the server has no keys — an intranet that
// advertises a feature it cannot deliver is worse than one that stays quiet.

export function PushOptIn({ className }: { className?: string }) {
  const { status, deviceCount, error, enable, disable } = usePushSubscription();

  // Silent for: still checking, unsupported browser, server not configured.
  if (
    status === "checking" ||
    status === "unsupported" ||
    status === "unconfigured"
  ) {
    return null;
  }

  const busy = status === "working";

  return (
    <div className={className}>
      {status === "denied" ? (
        // The browser will not prompt again from here; only the user can undo
        // it, so say where rather than offering a button that does nothing.
        <div className="flex items-start gap-2">
          <BellOff
            className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
            aria-hidden
          />
          <p className="text-muted-foreground text-xs">
            Notifications are blocked for this site. To turn them on, allow
            notifications in your browser’s site settings for this page.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-foreground text-xs font-medium">
              {status === "subscribed"
                ? "Notifications are on for this device"
                : "Get notified on this device"}
            </p>
            <p className="text-muted-foreground text-[11px]">
              {status === "subscribed"
                ? deviceCount > 1
                  ? `On ${deviceCount} devices.`
                  : "You’ll be notified even when the app is closed."
                : "Approvals and urgent items, even when the app is closed."}
            </p>
          </div>

          <Button
            size="sm"
            variant={status === "subscribed" ? "outline" : "default"}
            disabled={busy}
            onClick={() =>
              void (status === "subscribed" ? disable() : enable())
            }
            className="h-8 shrink-0"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Bell className="size-3.5" aria-hidden />
            )}
            {status === "subscribed" ? "Turn off" : "Enable"}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive mt-1.5 text-[11px]">
          {error}
        </p>
      )}
    </div>
  );
}
