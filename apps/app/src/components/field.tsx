import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      {children}
    </View>
  );
}
