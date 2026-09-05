import { AriaActions } from "@/components/aria/blocks/aria-actions";
import { AriaChecklist } from "@/components/aria/blocks/aria-checklist";
import { AriaCitations } from "@/components/aria/blocks/aria-citations";
import { AriaConfirm } from "@/components/aria/blocks/aria-confirm";
import { AriaKpiTiles } from "@/components/aria/blocks/aria-kpi-tiles";
import {
  type ActionsPayload,
  ariaBlockKindFromClassName,
  type ChecklistPayload,
  type CitationsPayload,
  type ConfirmPayload,
  extractPartialActions,
  type KpiTilesPayload,
  parseAriaBlock,
} from "@/components/aria/blocks/types";

/**
 * Drop-in replacement for the default `<code>` renderer used by
 * `react-markdown`. We let normal inline + fenced code blocks fall
 * through to the standard `<code>` element, but intercept any
 * fenced block whose language starts with `aria-` and route the
 * JSON body to one of our block renderers.
 *
 * On malformed JSON we return the original `<code>` so the user
 * still sees the data ARIA tried to format.
 */
export function AriaCodeBlock({
  className,
  children,
  onAction,
  actionsDisabled,
  ...rest
}: {
  className?: string;
  children?: React.ReactNode;
  onAction?: (prompt: string) => void;
  actionsDisabled?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  const kind = ariaBlockKindFromClassName(className);
  if (!kind) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }
  const raw = typeof children === "string" ? children : String(children ?? "");
  let parsed = parseAriaBlock(kind, raw);
  // For `actions` we tolerate mid-stream truncation: extract complete
  // `{...}` objects from the partial body and render whatever finished.
  // The tail-end partial chip will fill in on the next stream frame.
  if (!parsed && kind === "actions") {
    parsed = extractPartialActions(raw);
  }
  if (!parsed) {
    // Fall back to the raw code block so the user still sees what
    // ARIA tried to render. Better than an empty bubble.
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }
  if (parsed.kind === "checklist") {
    return <AriaChecklist payload={parsed.payload as ChecklistPayload} />;
  }
  if (parsed.kind === "kpi-tiles") {
    return <AriaKpiTiles payload={parsed.payload as KpiTilesPayload} />;
  }
  if (parsed.kind === "actions") {
    return (
      <AriaActions
        payload={parsed.payload as ActionsPayload}
        onAction={onAction}
        disabled={actionsDisabled}
      />
    );
  }
  if (parsed.kind === "citations") {
    return <AriaCitations payload={parsed.payload as CitationsPayload} />;
  }
  if (parsed.kind === "confirm") {
    return <AriaConfirm payload={parsed.payload as ConfirmPayload} />;
  }
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}
