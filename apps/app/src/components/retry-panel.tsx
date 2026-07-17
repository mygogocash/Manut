import { Button, colors, radii, spacing } from "@manut/ui";
import { Text, View } from "react-native";

interface RetryPanelProps {
  message: string;
  onRetry: () => void | Promise<void>;
  retrying?: boolean;
  compact?: boolean;
}

export function RetryPanel({
  message,
  onRetry,
  retrying = false,
  compact = false,
}: RetryPanelProps) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        alignSelf: compact ? "stretch" : "center",
        width: compact ? undefined : "100%",
        maxWidth: 520,
        gap: spacing.md,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.warningBorder,
        borderRadius: radii.panel,
        backgroundColor: colors.warningBackground,
      }}
    >
      <Text
        selectable
        style={{ fontSize: 17, fontWeight: "700", color: colors.warningText }}
      >
        Session verification paused
      </Text>
      <Text selectable style={{ color: colors.warningBody, lineHeight: 21 }}>
        {message}
      </Text>
      <Button
        label="Retry"
        pendingLabel="Retrying…"
        pending={retrying}
        accessibilityLabel="Retry session verification"
        onPress={onRetry}
        style={{
          alignSelf: "flex-start",
          minWidth: 112,
          paddingHorizontal: spacing.lg,
          paddingVertical: 11,
        }}
      />
    </View>
  );
}
