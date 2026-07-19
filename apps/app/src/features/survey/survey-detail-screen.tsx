import {
  announceSurvey,
  ApiError,
  archiveSurvey,
  getSurvey,
  getSurveyAnalytics,
  publishSurvey,
  replaceSurveyQuestions,
  replaceSurveyQuestionsInputSchema,
  scheduleSurvey,
  surveyAnalyticsQueryKey,
  surveyDetailQueryKey,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
  TextField,
} from "@manut/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

import {
  draftsToQuestionInputs,
  SurveyQuestionListEditor,
} from "./survey-question-list-editor";
import { useQuestionDraftsFromDetail } from "./use-question-drafts-from-detail";

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

export function SurveyDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("survey:manage");
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);

  const [builderError, setBuilderError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [manageMessage, setManageMessage] = useState<string | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAnalytics, setShowAnalytics] = useState(false);

  const detailQuery = useQuery({
    queryKey: surveyDetailQueryKey(id ?? ""),
    queryFn: ({ signal }) => getSurvey(api, id!, signal),
    enabled: id !== null,
  });

  const [drafts, setDrafts] = useQuestionDraftsFromDetail(detailQuery.data);

  const analyticsQuery = useQuery({
    queryKey: surveyAnalyticsQueryKey(id ?? ""),
    queryFn: ({ signal }) => getSurveyAnalytics(api, id!, signal),
    enabled: id !== null && canManage && showAnalytics,
  });

  const saveQuestionsMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing survey id.");
      const parsed = replaceSurveyQuestionsInputSchema.safeParse({
        questions: draftsToQuestionInputs(drafts),
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(issue?.message ?? "Check the questions and try again.");
      }
      return replaceSurveyQuestions(api, id, parsed.data);
    },
    onSuccess: (updated) => {
      setBuilderError(null);
      setManageMessage("Questions saved.");
      void queryClient.setQueryData(surveyDetailQueryKey(id ?? ""), updated);
      void queryClient.invalidateQueries({ queryKey: ["survey", "list"] });
    },
    onError: (error) => {
      setManageMessage(null);
      if (error instanceof Error && !(error instanceof ApiError)) {
        setBuilderError(error.message);
        return;
      }
      setBuilderError(errorMessage(error, "Unable to save questions."));
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing survey id.");
      return publishSurvey(api, id);
    },
    onSuccess: (updated) => {
      setPublishError(null);
      setManageMessage("Survey published.");
      void queryClient.setQueryData(surveyDetailQueryKey(id ?? ""), updated);
      void queryClient.invalidateQueries({ queryKey: ["survey", "list"] });
    },
    onError: (error) => {
      setPublishError(errorMessage(error, "Unable to publish survey."));
    },
  });

  const announceMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing survey id.");
      return announceSurvey(api, id, { wall: true });
    },
    onSuccess: (result) => {
      setManageError(null);
      setManageMessage(
        result.posted.length > 0
          ? `Announced on: ${result.posted.join(", ")}.`
          : "Announce completed (no surfaces posted).",
      );
    },
    onError: (error) => {
      setManageError(errorMessage(error, "Unable to announce survey."));
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing survey id.");
      return scheduleSurvey(api, id, {
        startDate: startDate.trim() || null,
        endDate: endDate.trim() || null,
      });
    },
    onSuccess: (updated) => {
      setManageError(null);
      setManageMessage("Schedule saved.");
      void queryClient.setQueryData(surveyDetailQueryKey(id ?? ""), updated);
    },
    onError: (error) => {
      setManageError(errorMessage(error, "Unable to save schedule."));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing survey id.");
      return archiveSurvey(api, id);
    },
    onSuccess: (updated) => {
      setManageError(null);
      setManageMessage("Survey archived.");
      void queryClient.setQueryData(surveyDetailQueryKey(id ?? ""), updated);
      void queryClient.invalidateQueries({ queryKey: ["survey", "list"] });
    },
    onError: (error) => {
      setManageError(errorMessage(error, "Unable to archive survey."));
    },
  });

  const isDraft = detailQuery.data?.status === "draft";
  const isPublished = detailQuery.data?.status === "published";
  const showBuilder = canManage && isDraft;
  const showManageActions = canManage && !isDraft;

  if (!id) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Survey" maxWidth={720}>
          <StatusMessage tone="error">Missing survey id.</StatusMessage>
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
        <Card title="Survey" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            {detailQuery.isLoading ? (
              <LoadingState label="Loading survey…" />
            ) : null}
            {detailQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(detailQuery.error, "Unable to load survey.")}
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
                  {detailQuery.data.alreadyResponded ? " · Responded" : ""}
                </Text>
                {detailQuery.data.description ? (
                  <Text selectable style={{ color: colors.textMuted }}>
                    {detailQuery.data.description}
                  </Text>
                ) : null}
                {!showBuilder
                  ? detailQuery.data.questions.map((question) => (
                      <Text
                        key={question.id}
                        selectable
                        style={{ color: colors.text }}
                      >
                        {question.order + 1}. {question.prompt}
                        {question.required ? " *" : ""}
                      </Text>
                    ))
                  : null}
              </View>
            ) : null}

            {showBuilder ? (
              <View style={{ gap: spacing.md }}>
                <Text selectable style={{ color: colors.textMuted }}>
                  Draft question list. Reorder with move up/down.
                </Text>
                <SurveyQuestionListEditor
                  drafts={drafts}
                  onChange={setDrafts}
                  disabled={
                    saveQuestionsMutation.isPending || publishMutation.isPending
                  }
                />
                {builderError ? (
                  <StatusMessage tone="error">{builderError}</StatusMessage>
                ) : null}
                <Button
                  label="Save questions"
                  pendingLabel="Saving…"
                  accessibilityLabel="Save questions"
                  pending={saveQuestionsMutation.isPending}
                  onPress={() => saveQuestionsMutation.mutate()}
                />
                <Button
                  label="Publish survey"
                  pendingLabel="Publishing…"
                  accessibilityLabel="Publish survey"
                  pending={publishMutation.isPending}
                  onPress={() => publishMutation.mutate()}
                />
                {publishError ? (
                  <StatusMessage tone="error">{publishError}</StatusMessage>
                ) : null}
              </View>
            ) : null}

            {showManageActions ? (
              <View style={{ gap: spacing.md }}>
                <Text selectable style={{ color: colors.textMuted }}>
                  Manage announce, schedule, analytics, and archive.
                </Text>
                {isPublished ? (
                  <Button
                    label="Announce on wall"
                    pendingLabel="Announcing…"
                    accessibilityLabel="Announce survey"
                    pending={announceMutation.isPending}
                    onPress={() => {
                      setManageMessage(null);
                      announceMutation.mutate();
                    }}
                  />
                ) : null}
                <View style={{ gap: spacing.sm }}>
                  <TextField
                    label="Start date (YYYY-MM-DD)"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                  <TextField
                    label="End date (YYYY-MM-DD)"
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                  <Button
                    label="Save schedule"
                    pendingLabel="Saving…"
                    accessibilityLabel="Save survey schedule"
                    pending={scheduleMutation.isPending}
                    onPress={() => {
                      setManageMessage(null);
                      scheduleMutation.mutate();
                    }}
                  />
                </View>
                <Button
                  label={showAnalytics ? "Hide analytics" : "Show analytics"}
                  pendingLabel="Working…"
                  accessibilityLabel="Toggle survey analytics"
                  onPress={() => setShowAnalytics((current) => !current)}
                />
                {showAnalytics ? (
                  analyticsQuery.isPending ? (
                    <LoadingState label="Loading analytics…" />
                  ) : analyticsQuery.isError ? (
                    <StatusMessage tone="error">
                      {errorMessage(
                        analyticsQuery.error,
                        "Unable to load analytics.",
                      )}
                    </StatusMessage>
                  ) : analyticsQuery.data ? (
                    <View
                      accessibilityLabel="Survey analytics summary"
                      style={{ gap: spacing.sm }}
                    >
                      <Text selectable style={{ color: colors.textMuted }}>
                        Total responses: {analyticsQuery.data.totalResponses}
                      </Text>
                      {analyticsQuery.data.questions.map((question) => (
                        <Text
                          key={question.id}
                          selectable
                          style={{ color: colors.textMuted }}
                        >
                          {question.prompt}: {question.responses} answers
                          {question.kind === "numeric" &&
                          question.average != null
                            ? ` · avg ${question.average.toFixed(1)}`
                            : ""}
                          {question.kind === "text"
                            ? ` · ${question.sampleCount} samples`
                            : ""}
                        </Text>
                      ))}
                    </View>
                  ) : null
                ) : null}
                <Button
                  label="Archive survey"
                  pendingLabel="Archiving…"
                  accessibilityLabel="Archive survey"
                  pending={archiveMutation.isPending}
                  onPress={() => {
                    setManageMessage(null);
                    archiveMutation.mutate();
                  }}
                />
              </View>
            ) : null}

            {manageMessage ? (
              <StatusMessage tone="success">{manageMessage}</StatusMessage>
            ) : null}
            {manageError ? (
              <StatusMessage tone="error">{manageError}</StatusMessage>
            ) : null}

            <Button
              label={
                detailQuery.data?.alreadyResponded
                  ? "View my response status"
                  : "Respond to survey"
              }
              pendingLabel="Working…"
              onPress={() => router.push(`/survey/${id}/respond`)}
            />
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
