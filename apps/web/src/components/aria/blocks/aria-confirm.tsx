"use client";

import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import type { ConfirmPayload } from "@/components/aria/blocks/types";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { confirmAriaAction } from "@/services/aria.service";

/**
 * Draft-and-confirm renderer (ARIA improvement #7, 2026-05-25).
 *
 * Write tools (e.g. submit_leave_request) emit this block via the
 * model after returning. The user clicks Approve → FE POSTs the
 * signed token to `/aria/confirm-action` which actually mutates state.
 * Token verification + permission re-check happens on the server.
 */
export function AriaConfirm({ payload }: { payload: ConfirmPayload }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  async function approve() {
    setState("running");
    try {
      await confirmAriaAction(payload.token);
      setState("done");
      toast.success("Action submitted");
    } catch (err) {
      setState("idle");
      const msg =
        err instanceof ApiError ? err.message : "Failed to submit action";
      toast.error(msg);
    }
  }

  return (
    <div
      className={`
        border-primary/40 bg-primary/5 my-3 rounded-md border p-3 text-sm
      `}
    >
      <div className="text-foreground mb-2 flex items-center gap-1.5">
        <ShieldAlert className="text-primary size-4" />
        <span className="font-medium">Action requires your approval</span>
      </div>
      <p className="text-foreground mb-2 text-[13px] leading-snug">
        {payload.summary}
      </p>
      {Object.keys(payload.params).length > 0 ? (
        <dl
          className={`
            border-border bg-background mb-3 grid grid-cols-[auto_1fr] gap-x-3
            gap-y-1 rounded border p-2 text-xs
          `}
        >
          {Object.entries(payload.params).map(([k, v]) => (
            // Short Fragment can't carry a key — React logs a "unique
            // key prop" warning for every confirm-block render. Use
            // `<Fragment>` explicitly so the warning goes away.
            <Fragment key={k}>
              <dt className="text-muted-foreground capitalize tabular-nums">
                {k.replace(/[_-]/g, " ")}
              </dt>
              <dd className="text-foreground break-words">
                {v === null || v === undefined ? "—" : String(v)}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
      {state === "done" ? (
        <div className={`flex items-center gap-1.5 text-xs text-emerald-600`}>
          <CheckCircle2 className="size-3.5" />
          Submitted.
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => void approve()}
            disabled={state === "running"}
          >
            {state === "running" ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : null}
            Approve & submit
          </Button>
        </div>
      )}
    </div>
  );
}
