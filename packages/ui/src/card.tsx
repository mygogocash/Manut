import type { ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";

import { colors, radii, spacing } from "./tokens";

export interface CardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  style?: ViewStyle;
  maxWidth?: number;
}

export function Card({
  title,
  description,
  children,
  style,
  maxWidth = 720,
}: CardProps) {
  return (
    <View
      style={[
        {
          maxWidth,
          width: "100%",
          gap: spacing.md - 2,
          padding: spacing.xxl,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.card,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      {title || description ? (
        <View style={{ gap: spacing.xs }}>
          {title ? (
            <Text
              selectable
              accessibilityRole="header"
              style={{
                fontSize: 26,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text
              selectable
              style={{ color: colors.textMuted, lineHeight: 22 }}
            >
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
