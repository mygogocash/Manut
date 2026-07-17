import { ActivityIndicator, Text, View } from "react-native";

import { colors, spacing } from "./tokens";

export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 320,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        padding: spacing.xxl,
        backgroundColor: colors.canvas,
      }}
    >
      <ActivityIndicator size="large" color={colors.accent} />
      <Text selectable style={{ color: colors.textMuted }}>
        {label}
      </Text>
    </View>
  );
}
