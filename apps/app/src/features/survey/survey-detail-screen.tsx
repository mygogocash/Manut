import {
  ApiError,
  getSurvey,
  publishSurvey,
  replaceSurveyQuestions,
  replaceSurveyQuestionsInputSchema,
  surveyDetailQueryKey,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
} from "@manut/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

import {
  draftsFromQuestions,
  draftsToQuestionInputs,
  SurveyQuestionListEditor,
  type QuestionDraft,
} from "./survey-question-list-editor";

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

  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: surveyDetailQueryKey(id ?? ""),
    queryFn: ({ signal }) => getSurvey(api, id!, signal),
    enabled: id !== null,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setDrafts(draftsFromQuestions(detailQuery.data.questions));
  }, [detailQuery.data]);

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
      setSaveMessage("Questions saved.");
      void queryClient.setQueryData(surveyDetailQueryKey(id ?? ""), updated);
      void queryClient.invalidateQueries({ queryKey: ["survey", "list"] });
    },
    onError: (error) => {
      setSaveMessage(null);
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
      setSaveMessage(null);
      void queryClient.setQueryData(surveyDetailQueryKey(id ?? ""), updated);
      void queryClient.invalidateQueries({ queryKey: ["survey", "list"] });
    },
    onError: (error) => {
      setPublishError(errorMessage(error, "Unable to publish survey."));
    },
  });

  const isDraft = detailQuery.data?.status === "draft";
  const showBuilder = canManage && isDraft;

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
                  Draft question list. Reorder with move up/down. Announce,
                  schedule, and analytics remain deferred.
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
                {saveMessage ? (
                  <StatusMessage tone="success">{saveMessage}</StatusMessage>
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
