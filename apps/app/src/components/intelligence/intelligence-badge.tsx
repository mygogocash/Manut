import { Text, View } from "react-native";
import { cn } from "@/lib/utils";

/**
 * "✦ Manut Intelligence" motif (Brand CI §24) — marks content that was
 * created or interpreted by Manut's AI. The four-point sparkle is the
 * intelligence mark; it never goes in the primary logo.
 */
export function IntelligenceBadge({
  label = "Manut Intelligence",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-1.5 self-start rounded-full bg-intelligence-50 px-2.5 py-1",
        className,
      )}
    >
      <Text className="text-[11px] leading-none text-intelligence-900" aria-hidden>
        ✦
      </Text>
      <Text className="text-[11px] font-medium uppercase tracking-wide leading-none text-intelligence-900">
        {label}
      </Text>
    </View>
  );
}
