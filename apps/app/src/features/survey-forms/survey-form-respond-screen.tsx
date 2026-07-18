import {
  ApiError,
  getMySurveyFormResponse,
  getSurveyForm,
  submitSurveyFormResponse,
  submitSurveyFormResponseInputSchema,
  surveyFormDetailQueryKey,
  surveyFormMyResponseQueryKey,
  type SubmittedSurveyFormResponse,
  type SurveyFormDetail,
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
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

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

type AnswerDraft = Record<string, string>;

function isInfoQuestion(type: string): boolean {
  return type === "info";
}

function isChoiceQuestion(type: string): boolean {
  return type === "single_choice" || type === "multi_choice";
}

function isNumericQuestion(type: string): boolean {
  return type === "rating" || type === "number";
}

function buildAnswersPayload(
  form: SurveyFormDetail,
  drafts: AnswerDraft,
): {
  answers: Array<{ questionId: string; value?: string | number | string[] }>;
} {
  const answers: Array<{
    questionId: string;
    value?: string | number | string[];
  }> = [];

  for (const question of form.questions) {
    if (isInfoQuestion(question.type)) continue;
    const raw = (drafts[question.id] ?? "").trim();
    if (!raw) {
      if (question.required) {
        throw new Error(`Answer required: ${question.prompt}`);
      }
      continue;
    }

    if (question.type === "multi_choice") {
      const selected = raw
        .split("\n")
        .map((part) => part.trim())
        .filter(Boolean);
      answers.push({ questionId: question.id, value: selected });
      continue;
    }

    if (isNumericQuestion(question.type)) {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        throw new Error(`Enter a number for: ${question.prompt}`);
      }
      answers.push({ questionId: question.id, value: numeric });
      continue;
    }

    answers.push({ questionId: question.id, value: raw });
  }

  return { answers };
}

function ChoiceOptions({
  question,
  value,
  onChange,
}: {
  question: SurveyFormDetail["questions"][number];
  value: string;
  onChange: (next: string) => void;
}) {
  const selected =
    question.type === "multi_choice"
      ? new Set(
          value
            .split("\n")
            .map((part) => part.trim())
            .filter(Boolean),
        )
      : new Set(value ? [value] : []);

  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ fontWeight: "600", color: colors.textStrong }}>
        {question.prompt}
        {question.required ? " *" : ""}
      </Text>
      {question.options.map((option) => {
        const isSelected = selected.has(option);
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={`${question.prompt}: ${option}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              if (question.type === "multi_choice") {
                const next = new Set(selected);
                if (next.has(option)) next.delete(option);
                else next.add(option);
                onChange([...next].join("\n"));
                return;
              }
              onChange(option);
            }}
            style={{
              padding: spacing.md,
              borderWidth: 1,
              borderColor: isSelected ? colors.borderStrong : colors.border,
              backgroundColor: colors.surfaceRaised,
            }}
          >
            <Text style={{ color: colors.text }}>
              {isSelected ? "● " : "○ "}
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SurveyFormRespondScreen() {
  const api = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);

  const [drafts, setDrafts] = useState<AnswerDraft>({});
  const [submitted, setSubmitted] =
    useState<SubmittedSurveyFormResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: surveyFormDetailQueryKey(id ?? ""),
    queryFn: ({ signal }) => getSurveyForm(api, id!, signal),
    enabled: id !== null,
  });

  const responseQuery = useQuery({
    queryKey: surveyFormMyResponseQueryKey(id ?? ""),
    queryFn: ({ signal }) => getMySurveyFormResponse(api, id!, signal),
    enabled: id !== null,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setDrafts((current) => {
      const next: AnswerDraft = { ...current };
      for (const question of detailQuery.data.questions) {
        if (next[question.id] === undefined) next[question.id] = "";
      }
      return next;
    });
  }, [detailQuery.data]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!detailQuery.data || !id) {
        throw new Error("Survey form is not loaded yet.");
      }
      const built = buildAnswersPayload(detailQuery.data, drafts);
      const parsed = submitSurveyFormResponseInputSchema.safeParse(built);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(issue?.message ?? "Check your answers and try again.");
      }
      return submitSurveyFormResponse(api, id, parsed.data);
    },
    onSuccess: (receipt) => {
      setSubmitted(receipt);
      setValidationError(null);
      setSubmitError(null);
      void queryClient.invalidateQueries({
        queryKey: surveyFormMyResponseQueryKey(id ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: surveyFormDetailQueryKey(id ?? ""),
      });
    },
    onError: (error) => {
      if (error instanceof Error && !(error instanceof ApiError)) {
        setValidationError(error.message);
        setSubmitError(null);
        return;
      }
      setValidationError(null);
      setSubmitError(errorMessage(error, "Unable to submit response."));
    },
  });

  if (!id) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Survey form response" maxWidth={720}>
          <StatusMessage tone="error">Missing survey form id.</StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  const loading = detailQuery.isLoading || responseQuery.isLoading;
  const error = detailQuery.error ?? responseQuery.error;
  const responseReceipt = submitted ?? responseQuery.data ?? null;
  const hasResponse = responseReceipt != null;
  const canSubmit =
    detailQuery.data != null &&
    detailQuery.data.status === "published" &&
    !hasResponse &&
    !detailQuery.data.alreadyResponded;

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
            {loading ? <LoadingState label="Loading response form…" /> : null}
            {error ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(error, "Unable to load response form.")}
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
            {hasResponse ? (
              <StatusMessage tone="warning">
                {`Response recorded (${String(responseReceipt.answerCount)} answers). Answer values are not shown.`}
              </StatusMessage>
            ) : null}
            {!hasResponse &&
            detailQuery.data &&
            detailQuery.data.status !== "published" ? (
              <StatusMessage tone="warning">
                This survey form is not open for responses.
              </StatusMessage>
            ) : null}
            {canSubmit
              ? detailQuery.data.questions.map((question) => {
                  if (isInfoQuestion(question.type)) {
                    return (
                      <Text
                        key={question.id}
                        selectable
                        style={{ color: colors.textMuted }}
                      >
                        {question.prompt}
                      </Text>
                    );
                  }
                  if (isChoiceQuestion(question.type)) {
                    return (
                      <ChoiceOptions
                        key={question.id}
                        question={question}
                        value={drafts[question.id] ?? ""}
                        onChange={(next) =>
                          setDrafts((current) => ({
                            ...current,
                            [question.id]: next,
                          }))
                        }
                      />
                    );
                  }
                  const fieldLabel = question.required
                    ? `${question.prompt} *`
                    : question.prompt;
                  return (
                    <TextField
                      key={question.id}
                      label={fieldLabel}
                      value={drafts[question.id] ?? ""}
                      onChangeText={(next) =>
                        setDrafts((current) => ({
                          ...current,
                          [question.id]: next,
                        }))
                      }
                      keyboardType={
                        isNumericQuestion(question.type) ? "numeric" : "default"
                      }
                      multiline={question.type === "long_text"}
                      style={
                        question.type === "long_text"
                          ? { minHeight: 96, textAlignVertical: "top" }
                          : undefined
                      }
                    />
                  );
                })
              : null}
            {validationError ? (
              <StatusMessage tone="error">{validationError}</StatusMessage>
            ) : null}
            {submitError ? (
              <StatusMessage tone="error">{submitError}</StatusMessage>
            ) : null}
            {canSubmit ? (
              <Button
                label="Submit response"
                pendingLabel="Submitting…"
                accessibilityLabel="Submit survey form response"
                pending={submitMutation.isPending}
                onPress={() => submitMutation.mutate()}
              />
            ) : null}
            <Button
              label="Back to form"
              pendingLabel="Working…"
              onPress={() => router.push(`/survey-forms/${id}`)}
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
