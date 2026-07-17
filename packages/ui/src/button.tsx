import {
  ActivityIndicator,
  Pressable,
  Text,
  type ViewStyle,
} from "react-native";

import { colors, radii, spacing } from "./tokens";

export interface ButtonProps {
  label: string;
  pendingLabel: string;
  pending?: boolean;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function Button({
  label,
  pendingLabel,
  pending = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const isDisabled = disabled || pending;
  const resolvedLabel = pending ? pendingLabel : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? resolvedLabel}
      accessibilityState={{ disabled: isDisabled, busy: pending }}
      disabled={isDisabled}
      onPress={() => {
        void onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          borderRadius: radii.control,
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
          opacity: isDisabled ? 0.65 : 1,
        },
        style,
      ]}
    >
      {pending ? <ActivityIndicator color={colors.onAccent} /> : null}
      <Text selectable style={{ color: colors.onAccent, fontWeight: "700" }}>
        {resolvedLabel}
      </Text>
    </Pressable>
  );
}
