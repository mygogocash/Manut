import { colors, spacing } from "@manut/ui";
import { Text, View } from "react-native";

export interface SimpleBarDatum {
  label: string;
  value: number;
}

export function SimpleBarSeries({
  title,
  description,
  data,
  emptyLabel,
  formatValue = (value) => String(value),
}: {
  title: string;
  description?: string;
  data: SimpleBarDatum[];
  emptyLabel: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(0, ...data.map((row) => row.value));
  return (
    <View
      accessibilityLabel={title}
      style={{
        gap: spacing.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text
          selectable
          accessibilityRole="header"
          style={{ fontWeight: "700", color: colors.text, fontSize: 18 }}
        >
          {title}
        </Text>
        {description ? (
          <Text selectable style={{ color: colors.textMuted }}>
            {description}
          </Text>
        ) : null}
      </View>
      {data.length === 0 ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {emptyLabel}
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {data.map((row) => {
            const widthPercent =
              max <= 0 ? 0 : Math.max(4, Math.round((row.value / max) * 100));
            return (
              <View key={row.label} style={{ gap: 4 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: spacing.sm,
                  }}
                >
                  <Text selectable style={{ color: colors.text, flex: 1 }}>
                    {row.label}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted }}>
                    {formatValue(row.value)}
                  </Text>
                </View>
                <View
                  style={{
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: colors.canvas,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${widthPercent}%`,
                      height: "100%",
                      backgroundColor: colors.accent,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
