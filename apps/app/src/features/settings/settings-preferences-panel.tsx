import {
  mergeLocalPreferences,
  type LocalPreferences,
} from "@manut/app-core";
import { Card, SwitchField, colors, spacing } from "@manut/ui";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  loadLocalPreferences,
  saveLocalPreferences,
} from "@/features/settings/preferences-storage";

const THEME_OPTIONS: Array<LocalPreferences["theme"]> = [
  "system",
  "light",
  "dark",
];

export function SettingsPreferencesPanel() {
  const [preferences, setPreferences] = useState<LocalPreferences>(() =>
    loadLocalPreferences(),
  );

  function update(patch: Partial<LocalPreferences>) {
    const next = mergeLocalPreferences(preferences, patch);
    setPreferences(next);
    saveLocalPreferences(next);
  }

  return (
    <Card
      title="Preferences"
      description="Stored on this device. Notification delivery still follows server policy."
    >
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
            Theme
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {THEME_OPTIONS.map((theme) => {
              const selected = preferences.theme === theme;
              return (
                <Pressable
                  key={theme}
                  accessibilityRole="button"
                  accessibilityLabel={`Theme ${theme}`}
                  accessibilityState={{ selected }}
                  onPress={() => update({ theme })}
                  style={{
                    minHeight: 42,
                    justifyContent: "center",
                    paddingHorizontal: spacing.lg,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.borderStrong,
                    borderRadius: 8,
                    backgroundColor: selected
                      ? colors.accent
                      : colors.surfaceRaised,
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: selected ? colors.onAccent : colors.text,
                      fontWeight: "700",
                      textTransform: "capitalize",
                    }}
                  >
                    {theme}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text selectable style={{ color: colors.textMuted }}>
          Language: English
        </Text>

        <SwitchField
          label="Email notifications"
          description="Receive leave and approval email notices when the mail service is configured."
          value={preferences.emailNotifications}
          onValueChange={(emailNotifications) =>
            update({ emailNotifications })
          }
        />
        <SwitchField
          label="In-app notifications"
          description="Show in-product notices for approvals and reminders on this device."
          value={preferences.inAppNotifications}
          onValueChange={(inAppNotifications) =>
            update({ inAppNotifications })
          }
        />
      </View>
    </Card>
  );
}
