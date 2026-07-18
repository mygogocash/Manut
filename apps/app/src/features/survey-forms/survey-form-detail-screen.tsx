import {
  ApiError,
  getSurveyForm,
  surveyFormDetailQueryKey,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
} from "@manut/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
    return value[0];
  }
  return null;
}

export function SurveyFormDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("survey:manage-wave");
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);

  const detailQuery = useQuery({
    queryKey: surveyFormDetailQueryKey(id ?? ""),
    queryFn: ({ signal }) => getSurveyForm(api, id!, signal),
    enabled: id !== null,
  });

  if (!id) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Survey form" maxWidth={720}>
          <StatusMessage tone="error">Missing survey form id.</StatusMessage>
        </Card>
      </ScrollView>
    );
  }

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
        <Card title="Survey form" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            {detailQuery.isLoading ? (
              <LoadingState label="Loading survey form…" />
            ) : null}
            {detailQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    detailQuery.error,
                    "Unable to load survey form.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void detailQuery.refetch()}
                />
              </View>
            ) : null}
            {detailQuery.data ? (
              <View style={{ gap: spacing.sm }}>
                <Text
                  selectable
                  style={{ fontWeight: "600", color: colors.text }}
                >
                  {detailQuery.data.title}
                </Text>
                <Text selectable style={{ color: colors.textMuted }}>
                  {detailQuery.data.status} · {detailQuery.data.questionCount}{" "}
                  questions
                </Text>
                {detailQuery.data.questions.map((question) => (
                  <Text
                    key={question.id}
                    selectable
                    style={{ color: colors.text }}
                  >
                    {question.order + 1}. {question.prompt}
                    {question.required ? " *" : ""}
                  </Text>
                ))}
                {canManage && detailQuery.data.status === "draft" ? (
                  <StatusMessage tone="warning">
                    Draft ready for manage. Question replace, publish, announce,
                    and analytics remain deferred.
                  </StatusMessage>
                ) : null}
              </View>
            ) : null}
            <Button
              label="Response status"
              pendingLabel="Working…"
              onPress={() => router.push(`/survey-forms/${id}/respond`)}
            />
            {canManage ? (
              <Button
                label="New survey form"
                pendingLabel="Working…"
                onPress={() => router.push("/survey-forms/new")}
              />
            ) : null}
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
