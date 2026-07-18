import {
  ApiError,
  createSurvey,
  createSurveyInputSchema,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  spacing,
  StatusMessage,
  TextField,
} from "@manut/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function SurveyNewScreen() {
  const api = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const allowed = hasPermission("survey:manage");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      const parsed = createSurveyInputSchema.safeParse({
        title,
        description: description.trim() ? description.trim() : null,
        isAnonymous,
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(issue?.message ?? "Check the form and try again.");
      }
      return createSurvey(api, parsed.data);
    },
    onSuccess: (created) => {
      setValidationError(null);
      setSubmitError(null);
      void queryClient.invalidateQueries({ queryKey: ["survey", "list"] });
      router.push(`/survey/${created.id}`);
    },
    onError: (error) => {
      if (error instanceof Error && !(error instanceof ApiError)) {
        setValidationError(error.message);
        setSubmitError(null);
        return;
      }
      setValidationError(null);
      setSubmitError(errorMessage(error, "Unable to create survey."));
    },
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
        <Card title="New survey" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            {!allowed ? (
              <StatusMessage tone="error">
                You do not have permission to create surveys.
              </StatusMessage>
            ) : (
              <>
                <Text selectable style={{ color: colors.textMuted }}>
                  Creates a draft survey. Add questions and publish from the
                  detail screen. Announce, schedule, and analytics remain
                  deferred.
                </Text>
                <TextField
                  label="Title"
                  value={title}
                  onChangeText={setTitle}
                  autoCapitalize="sentences"
                />
                <TextField
                  label="Description"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  style={{ minHeight: 96, textAlignVertical: "top" }}
                />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Anonymous responses"
                  accessibilityState={{ checked: isAnonymous }}
                  onPress={() => setIsAnonymous((current) => !current)}
                  style={{ flexDirection: "row", gap: spacing.sm }}
                >
                  <Text style={{ color: colors.text }}>
                    {isAnonymous ? "☑" : "☐"} Anonymous responses
                  </Text>
                </Pressable>
                {validationError ? (
                  <StatusMessage tone="error">{validationError}</StatusMessage>
                ) : null}
                {submitError ? (
                  <StatusMessage tone="error">{submitError}</StatusMessage>
                ) : null}
                <Button
                  label="Create survey"
                  pendingLabel="Creating…"
                  pending={createMutation.isPending}
                  onPress={() => createMutation.mutate()}
                />
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
