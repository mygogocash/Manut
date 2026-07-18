import {
  ApiError,
  listSurveys,
  surveysQueryKey,
  type SurveySummary,
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

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function SurveyRow({
  survey,
  onPress,
}: {
  survey: SurveySummary;
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
        {survey.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {survey.status} · {survey.questionCount} questions
        {survey.alreadyResponded ? " · Responded" : ""}
        {survey.isAnonymous ? " · Anonymous" : ""}
      </Text>
    </Pressable>
  );
}

export function SurveyScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("survey:manage");

  const surveysQuery = useQuery({
    queryKey: surveysQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listSurveys(api, { page: 1, limit: 20 }, signal),
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
        <Card title="Surveys" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Survey list with draft create. Question builder, publish, and
              analytics remain deferred.
            </Text>
            {canManage ? (
              <Button
                label="New survey"
                pendingLabel="Working…"
                onPress={() => router.push("/survey/new")}
              />
            ) : null}
            {surveysQuery.isLoading ? (
              <LoadingState label="Loading surveys…" />
            ) : null}
            {surveysQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(surveysQuery.error, "Unable to load surveys.")}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void surveysQuery.refetch()}
                />
              </View>
            ) : null}
            {surveysQuery.data?.data.length === 0 ? (
              <StatusMessage tone="warning">No surveys found.</StatusMessage>
            ) : null}
            {surveysQuery.data?.data.map((survey) => (
              <SurveyRow
                key={survey.id}
                survey={survey}
                onPress={() => router.push(`/survey/${survey.id}`)}
              />
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
