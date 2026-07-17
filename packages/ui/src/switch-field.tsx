import { Switch, Text, View } from "react-native";

import { colors, spacing } from "./tokens";

export interface SwitchFieldProps {
  label: string;
  description?: string;
  value: boolean;
  disabled?: boolean;
  pending?: boolean;
  onValueChange: (value: boolean) => void;
}

export function SwitchField({
  label,
  description,
  value,
  disabled = false,
  pending = false,
  onValueChange,
}: SwitchFieldProps) {
  const isDisabled = disabled || pending;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.lg,
      }}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text selectable style={{ fontWeight: "700", color: colors.text }}>
          {label}
        </Text>
        {description ? (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{
          checked: value,
          disabled: isDisabled,
          busy: pending,
        }}
        disabled={isDisabled}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.borderStrong, true: colors.accent }}
        thumbColor={colors.surfaceRaised}
      />
    </View>
  );
}
