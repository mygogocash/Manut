import { forwardRef } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input as ShadcnInput } from "@/components/ui/input";
import {
  Select as SelectPrimitive,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface InputGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function InputGroup({ label, children, className }: InputGroupProps) {
  return (
    <Field className={cn("flex flex-col gap-1", className)}>
      <FieldLabel
        className={`
          text-muted-foreground text-[10.5px] font-semibold tracking-[0.04em]
          uppercase
        `}
      >
        {label}
      </FieldLabel>
      {children}
    </Field>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <ShadcnInput
      ref={ref}
      className={cn(
        `
          border-border bg-background-secondary h-auto rounded-md px-3 py-2
          text-[13px]
        `,
        "placeholder:text-muted-foreground",
        `
          focus-visible:border-primary focus-visible:bg-surface
          focus-visible:ring-primary/10
        `,
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <ShadcnTextarea
      ref={ref}
      className={cn(
        `
          border-border bg-background-secondary min-h-[80px] resize-y rounded-md
          px-3 py-2 text-[13px]
        `,
        "placeholder:text-muted-foreground",
        `
          focus-visible:border-primary focus-visible:bg-surface
          focus-visible:ring-primary/10
        `,
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

interface SelectProps {
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Select({
  placeholder,
  value,
  defaultValue,
  onValueChange,
  children,
  className,
  disabled,
}: SelectProps) {
  return (
    <SelectPrimitive
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <SelectTrigger
        disabled={disabled}
        className={cn(
          `
            border-border bg-background-secondary h-auto w-full rounded-md px-3
            py-2 text-[13px]
          `,
          `
            focus-visible:border-primary focus-visible:bg-surface
            focus-visible:ring-primary/10
          `,
          className,
        )}
      >
        <SelectValue placeholder={placeholder ?? "Select…"} />
      </SelectTrigger>
      <SelectContent position="popper">{children}</SelectContent>
    </SelectPrimitive>
  );
}

export { SelectItem };
export type { InputProps, SelectProps, TextareaProps };
