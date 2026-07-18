import { Card, colors, spacing, StatusMessage, Button } from "@manut/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
    return value[0];
  }
  return null;
}

export function SurveyFormRespondScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);

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
        <Card title="Survey form response" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Response submission for survey forms is deferred in this
              foundation slice.
            </Text>
            <StatusMessage tone="warning">
              Open the form detail to review questions.
            </StatusMessage>
            <Button
              label="Back to form"
      pendingLabel="Working…"
              onPress={() =>
                router.push(id ? `/survey-forms/${id}` : "/survey-forms")
              }
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
