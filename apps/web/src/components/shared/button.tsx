import { forwardRef } from "react";

import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "accent" | "danger" | "ghost";
type ButtonSize = "sm" | "default" | "lg" | "icon";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(13,11,7,0.18)] hover:bg-primary/90",
  secondary:
    "bg-surface text-foreground-secondary border border-border hover:bg-background",
  accent: "bg-primary-light text-foreground hover:opacity-90",
  danger:
    "bg-destructive/[8%] text-destructive border border-destructive/20 hover:bg-destructive/[15%]",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-border hover:text-foreground-secondary",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[11px]",
  default: "h-9 px-4 py-[7px] text-[12px]",
  lg: "h-10 px-6 text-[13px]",
  icon: "h-9 w-9",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "default",
      style,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <ShadcnButton
        ref={ref}
        type={type}
        className={cn(
          "gap-1.5 rounded-md font-semibold",
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          className,
        )}
        style={style}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
