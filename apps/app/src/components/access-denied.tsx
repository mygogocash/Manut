import { colors, spacing } from "@manut/ui";
import { Text, View } from "react-native";

export function AccessDenied({ reason }: { reason: string }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: spacing.xxl,
        backgroundColor: colors.canvas,
      }}
    >
      <Text
        selectable
        style={{ fontSize: 22, fontWeight: "700", color: colors.text }}
      >
        Access unavailable
      </Text>
      <Text selectable style={{ color: colors.textMuted, textAlign: "center" }}>
        {reason}
      </Text>
    </View>
  );
}
