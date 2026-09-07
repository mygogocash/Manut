import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Platform, Text as RNText } from "react-native";
import { cn } from "@/lib/utils";

const textVariants = cva(
  cn("text-base text-foreground", Platform.select({ web: "select-text" })),
  {
    variants: {
      variant: {
        default: "",
        h1: cn(
          "text-center text-4xl font-extrabold tracking-tight",
          Platform.select({ web: "scroll-m-20 text-balance" }),
        ),
        h2: cn(
          "border-b border-border pb-2 text-3xl font-semibold tracking-tight",
          Platform.select({ web: "scroll-m-20 first:mt-0" }),
        ),
        h3: cn("text-2xl font-semibold tracking-tight", Platform.select({ web: "scroll-m-20" })),
        h4: cn("text-xl font-semibold tracking-tight", Platform.select({ web: "scroll-m-20" })),
        p: "mt-3 leading-7 sm:mt-6",
        blockquote: "mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6",
        code: "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
        lead: "text-xl text-muted-foreground",
        large: "text-lg font-semibold",
        small: "text-sm font-medium leading-none",
        muted: "text-sm text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = "default",
  ...props
}: React.ComponentProps<typeof RNText> &
  VariantProps<typeof textVariants> & {
    asChild?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;
  return <Component className={cn(textVariants({ variant }), textClass, className)} {...props} />;
}

export { Text, TextClassContext, textVariants };
