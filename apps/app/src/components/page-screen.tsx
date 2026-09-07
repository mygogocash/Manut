import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { TABLET_MIN, useViewportWidth } from "@/hooks/use-viewport-width";
import { cn } from "@/lib/utils";

export function PageScreen({
  title,
  subtitle,
  children,
  scroll = true,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  className?: string;
}) {
  const compact = useViewportWidth() < TABLET_MIN;
  const pad = compact ? "px-4 py-5" : "px-6 py-6";
  const header = (
    <View className="mb-5 gap-1">
      <Text className={cn("font-bold tracking-tight text-foreground", compact ? "text-[22px]" : "text-[26px]")}>
        {title}
      </Text>
      {subtitle ? <Text className="max-w-[42rem] text-[15px] leading-6 text-muted-foreground">{subtitle}</Text> : null}
    </View>
  );

  if (!scroll) {
    return (
      <View className={cn("flex-1 bg-background", pad, className)}>
        {header}
        <View className="min-h-0 flex-1">{children}</View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName={cn(pad, className)}>
      {header}
      {children}
    </ScrollView>
  );
}
