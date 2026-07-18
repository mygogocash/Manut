import { Button, Card, colors, spacing, StatusMessage } from "@manut/ui";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";

export function SurveyFormNewScreen() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = hasPermission("survey:manage-wave");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        gap: spacing.lg,
        padding: spacing.xxl,
        backgroundColor: colors.canvas,
      }}
    >
      <View style={{ width: "100%", maxWidth: 720, gap: spacing.lg }}>
        <Card title="New survey form" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            {!allowed ? (
              <StatusMessage tone="error">
                You do not have permission to create survey forms.
              </StatusMessage>
            ) : (
              <>
                <Text selectable style={{ color: colors.textMuted }}>
                  Survey form creation is deferred in this foundation slice.
                </Text>
                <StatusMessage tone="warning">
                  Use the survey forms list to review existing forms.
                </StatusMessage>
              </>
            )}
            <Button
              label="Back to survey forms"
      pendingLabel="Working…"
              onPress={() => router.push("/survey-forms")}
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
