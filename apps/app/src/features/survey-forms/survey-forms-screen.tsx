import {
  ApiError,
  listSurveyForms,
  surveyFormsQueryKey,
  type SurveyFormSummary,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  radii,
  spacing,
  StatusMessage,
} from "@manut/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function FormRow({
  form,
  onPress,
}: {
  form: SurveyFormSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {form.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {form.status} · {form.questionCount} questions
        {form.alreadyResponded ? " · Responded" : ""}
      </Text>
    </Pressable>
  );
}

export function SurveyFormsScreen() {
  const api = useApiClient();
  const router = useRouter();

  const formsQuery = useQuery({
    queryKey: surveyFormsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listSurveyForms(api, { page: 1, limit: 20 }, signal),
  });

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
        <Card title="Survey forms" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only survey form list. Builder and wave management remain
              deferred.
            </Text>
            {formsQuery.isLoading ? (
              <LoadingState label="Loading survey forms…" />
            ) : null}
            {formsQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    formsQuery.error,
                    "Unable to load survey forms.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void formsQuery.refetch()}
                />
              </View>
            ) : null}
            {formsQuery.data?.data.length === 0 ? (
              <StatusMessage tone="warning">No survey forms found.</StatusMessage>
            ) : null}
            {formsQuery.data?.data.map((form) => (
              <FormRow
                key={form.id}
                form={form}
                onPress={() => router.push(`/survey-forms/${form.id}`)}
              />
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
