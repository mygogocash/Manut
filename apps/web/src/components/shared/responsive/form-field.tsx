"use client";

import { Paperclip } from "lucide-react";
import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Responsive field scaffolding — the gaps, not a new form system.
//
// `ui/form.tsx` (react-hook-form + zodResolver, 104 call sites) and
// `ui/field.tsx` (FieldSet / FieldLabel / FieldError / FieldDescription …)
// already exist and stay the primary way to build a form. Duplicating either
// would split the codebase in two.
//
// What was missing is only this: a field wrapper that is correct on a phone
// without each caller re-deriving it, and a file input that offers the camera.
// Everything below composes existing primitives.

export interface FormFieldShellProps extends React.ComponentProps<"div"> {
  label?: React.ReactNode;
  /** Associates the label and messages with the control. */
  htmlFor?: string;
  /** Helper text. Wired to the control via `aria-describedby` by the caller. */
  description?: React.ReactNode;
  /** Validation message. Announced politely; renders in the danger tone. */
  error?: React.ReactNode;
  required?: boolean;
  /** Dims the field. The control itself must also be disabled. */
  disabled?: boolean;
}

/**
 * Label, control, description, error — stacked, in that order, with the spacing
 * the design language uses.
 *
 * Stacked at every width on purpose: a label beside its input reads well on a
 * wide form and breaks at 320px, and pairing *fields* (via `FormRow`) already
 * gives back the horizontal density on desktop.
 */
export function FormFieldShell({
  label,
  htmlFor,
  description,
  error,
  required = false,
  disabled = false,
  className,
  children,
  ...props
}: FormFieldShellProps) {
  const descId = description && htmlFor ? `${htmlFor}-description` : undefined;
  const errId = error && htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div
      data-disabled={disabled || undefined}
      className={cn("min-w-0 space-y-1.5", disabled && "opacity-60", className)}
      {...props}
    >
      {label && (
        <Label htmlFor={htmlFor} className="text-xs font-medium">
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden>
              *
            </span>
          )}
          {required && <span className="sr-only">(required)</span>}
        </Label>
      )}

      {children}

      {description && !error && (
        <p id={descId} className="text-muted-foreground text-xs">
          {description}
        </p>
      )}

      {/* `role="alert"` so a validation failure is announced when it appears,
          rather than only being found by someone re-reading the field. */}
      {error && (
        <p id={errId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * A file input that does not look like a raw file input.
 *
 * `capture` is the mobile-specific part: with it, Android and iOS offer the
 * camera directly instead of only the file browser, which is what makes
 * photographing a receipt a two-tap operation. Left undefined by default —
 * forcing the camera on a document upload is wrong, so the caller opts in.
 */
export interface FileFieldProps extends Omit<
  React.ComponentProps<"input">,
  "type" | "className"
> {
  /** Text on the button. Defaults to "Choose file". */
  buttonLabel?: React.ReactNode;
  /** Name of the chosen file, if the caller is tracking it. */
  selectedName?: string | null;
  /**
   * `environment` offers the rear camera, `user` the front one. Set it only
   * where a photo is the expected input (receipts, evidence, ID scans).
   */
  capture?: "environment" | "user";
  className?: string;
}

export function FileField({
  buttonLabel = "Choose file",
  selectedName,
  capture,
  className,
  disabled,
  ...props
}: FileFieldProps) {
  const inputId = React.useId();

  return (
    <div className={cn("min-w-0", className)}>
      {/* A label styled as a button, wrapping a visually hidden input: keeps
          native keyboard and screen-reader behaviour, which a div-plus-onClick
          replacement loses. */}
      <label
        htmlFor={props.id ?? inputId}
        className={cn(
          `
            border-border bg-background text-foreground inline-flex h-10 min-w-0
            cursor-pointer items-center gap-2 rounded-md border px-3 text-sm
            focus-within:ring-ring focus-within:ring-2
            hover:bg-muted
            sm:h-9
          `,
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <Paperclip className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{selectedName || buttonLabel}</span>
        <input
          id={props.id ?? inputId}
          type="file"
          capture={capture}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
      </label>
    </div>
  );
}
