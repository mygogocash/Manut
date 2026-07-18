import {
  ApiError,
  getMySurveyResponse,
  getSurvey,
  surveyDetailQueryKey,
  surveyMyResponseQueryKey,
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

export function SurveyRespondScreen() {
  const api = useApiClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);

  const detailQuery = useQuery({
    queryKey: surveyDetailQueryKey(id ?? ""),
    queryFn: ({ signal }) => getSurvey(api, id!, signal),
    enabled: id !== null,
  });

  const responseQuery = useQuery({
    queryKey: surveyMyResponseQueryKey(id ?? ""),
    queryFn: ({ signal }) => getMySurveyResponse(api, id!, signal),
    enabled: id !== null,
  });

  if (!id) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Survey response" maxWidth={720}>
          <StatusMessage tone="error">Missing survey id.</StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  const loading = detailQuery.isLoading || responseQuery.isLoading;
  const error = detailQuery.error ?? responseQuery.error;

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
        <Card title="Survey response" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only response status. Submitting answers is deferred.
            </Text>
            {loading ? <LoadingState label="Loading response status…" /> : null}
            {error ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(error, "Unable to load response status.")}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => {
                    void detailQuery.refetch();
                    void responseQuery.refetch();
                  }}
                />
              </View>
            ) : null}
            {detailQuery.data ? (
              <Text
                selectable
                style={{ fontWeight: "600", color: colors.text }}
              >
                {detailQuery.data.title}
              </Text>
            ) : null}
            {responseQuery.data === null ? (
              <StatusMessage tone="warning">
                You have not submitted a response yet.
              </StatusMessage>
            ) : null}
            {responseQuery.data ? (
              <StatusMessage tone="warning">
                {`Response recorded (${String(responseQuery.data.answerCount)} answers). Answer values are not shown.`}
              </StatusMessage>
            ) : null}
            <Button
              label="Back to survey"
      pendingLabel="Working…"
              onPress={() => router.push(`/survey/${id}`)}
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
