import type { ComponentProps } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: ComponentProps<typeof View> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <View
      className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
      {...props}
    />
  );
}

export { Separator };
