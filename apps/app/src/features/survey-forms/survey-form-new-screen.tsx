import {
  ApiError,
  createSurveyForm,
  createSurveyFormInputSchema,
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

export function SurveyFormNewScreen() {
  const api = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const allowed = hasPermission("survey:manage-wave");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      const parsed = createSurveyFormInputSchema.safeParse({
        title,
        description: description.trim() ? description.trim() : null,
        isAnonymous,
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(issue?.message ?? "Check the form and try again.");
      }
      return createSurveyForm(api, parsed.data);
    },
    onSuccess: (created) => {
      setValidationError(null);
      setSubmitError(null);
      void queryClient.invalidateQueries({
        queryKey: ["survey-forms", "list"],
      });
      router.push(`/survey-forms/${created.id}`);
    },
    onError: (error) => {
      if (error instanceof Error && !(error instanceof ApiError)) {
        setValidationError(error.message);
        setSubmitError(null);
        return;
      }
      setValidationError(null);
      setSubmitError(errorMessage(error, "Unable to create survey form."));
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
        <Card title="New survey form" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            {!allowed ? (
              <StatusMessage tone="error">
                You do not have permission to create survey forms.
              </StatusMessage>
            ) : (
              <>
                <Text selectable style={{ color: colors.textMuted }}>
                  Creates a draft survey form. Question builder, publish, and
                  analytics remain deferred.
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
                  label="Create survey form"
                  pendingLabel="Creating…"
                  pending={createMutation.isPending}
                  onPress={() => createMutation.mutate()}
                />
              </>
            )}
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
