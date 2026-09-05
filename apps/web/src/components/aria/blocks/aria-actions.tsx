"use client";

import { ArrowUpRight } from "lucide-react";

import type { ActionsPayload } from "@/components/aria/blocks/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Inline action chips. Each click sends `prompt` back into the chat
 * as a new user turn — mirrors how the preset chips below the input
 * already work, but lets ARIA generate the suggestions contextually
 * after the previous reply.
 *
 * Click handler is owned by the chat page (passed through from
 * MessageBubble); the renderer just emits the buttons.
 *
 * HR / Tanny feedback (2026-05-26): the default `disabled:opacity-50`
 * on the global Button made the chip text unreadable when the chat
 * was busy (`disabled` flows in from `MessageBubble` whenever the
 * previous turn is still streaming). Override the disabled state on
 * just the chips: keep the click suppressed via the native attribute
 * but render the label at full contrast with a `cursor-not-allowed`
 * hint instead of fading the whole pill out.
 */
export function AriaActions({
  payload,
  onAction,
  disabled,
}: {
  payload: ActionsPayload;
  onAction?: (prompt: string) => void;
  disabled?: boolean;
}) {
  const isDisabled = disabled || !onAction;
  return (
    <div className="my-2 flex flex-wrap gap-2">
      {payload.actions.map((a, i) => (
        <Button
          key={`${i}-${a.label}`}
          type="button"
          variant={a.variant === "default" ? "default" : "outline"}
          size="sm"
          disabled={isDisabled}
          onClick={() => onAction?.(a.prompt)}
          className={cn(
            "h-7 gap-1 rounded-full px-3 text-xs",
            isDisabled &&
              "disabled:opacity-100 disabled:cursor-not-allowed text-foreground/80",
          )}
          title={a.prompt}
        >
          {a.label}
          <ArrowUpRight className="size-3 opacity-60" />
        </Button>
      ))}
    </div>
  );
}
