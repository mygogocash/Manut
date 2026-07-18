import { Button, Card, colors, spacing, StatusMessage } from "@manut/ui";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";

export function SurveyNewScreen() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = hasPermission("survey:manage");

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
        <Card title="New survey" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            {!allowed ? (
              <StatusMessage tone="error">
                You do not have permission to create surveys.
              </StatusMessage>
            ) : (
              <>
                <Text selectable style={{ color: colors.textMuted }}>
                  Survey creation is deferred in this foundation slice.
                </Text>
                <StatusMessage tone="warning">
                  Use the survey list to review existing surveys.
                </StatusMessage>
              </>
            )}
            <Button
              label="Back to surveys"
      pendingLabel="Working…"
              onPress={() => router.push("/survey")}
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
