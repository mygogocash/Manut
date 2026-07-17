import { useEffect } from "react";
import { AccessibilityInfo, Platform, Text, View } from "react-native";

import { statusAccessibilityRole, type StatusTone } from "./status-tone";
import { colors, radii, spacing } from "./tokens";

export { statusAccessibilityRole, type StatusTone } from "./status-tone";

export interface StatusMessageProps {
  children: string;
  tone?: StatusTone;
}

const toneStyles: Record<
  StatusTone,
  { border: string; background: string; text: string }
> = {
  error: {
    border: colors.errorBorder,
    background: colors.errorBackground,
    text: colors.errorText,
  },
  success: {
    border: colors.successBorder,
    background: colors.successBackground,
    text: colors.successText,
  },
  warning: {
    border: colors.warningBorder,
    background: colors.warningBackground,
    text: colors.warningText,
  },
};

export function StatusMessage({
  children,
  tone = "error",
}: StatusMessageProps) {
  const resolved = toneStyles[tone];

  useEffect(() => {
    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(children);
    }
  }, [children]);

  return (
    <View
      accessibilityRole={statusAccessibilityRole(tone)}
      accessibilityLiveRegion="polite"
      style={{
        padding: spacing.md,
        borderWidth: 1,
        borderColor: resolved.border,
        borderRadius: radii.control,
        backgroundColor: resolved.background,
      }}
    >
      <Text selectable style={{ color: resolved.text, lineHeight: 20 }}>
        {children}
      </Text>
    </View>
  );
}
