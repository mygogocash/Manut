import {
  ApiError,
  LEARNING_COMPLETIONS_QUERY_ROOT,
  LEARNING_MODULES_QUERY_ROOT,
  learningCompletionsQueryKey,
  learningModulesQueryKey,
  listLearningCompletions,
  listLearningModules,
  markLearningComplete,
  type LearningModule,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadLearning(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("learning:read") ||
    hasPermission("learning:complete") ||
    hasPermission("learning:manage") ||
    hasPermission("learning:hr-read")
  );
}

function canCompleteLearning(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("learning:complete");
}

function ExternalLinkButton({ title, url }: { title: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${title} external link`}
      onPress={() => {
        void Linking.openURL(url);
      }}
    >
      <Text style={{ color: colors.accent, fontWeight: "600" }}>
        Open external link
      </Text>
    </Pressable>
  );
}

function ModuleRow({
  module,
  canComplete,
  isCompleted,
  isMarkingComplete,
  onMarkComplete,
}: {
  module: LearningModule;
  canComplete: boolean;
  isCompleted: boolean;
  isMarkingComplete: boolean;
  onMarkComplete: (moduleId: string) => void;
}) {
  return (
    <View
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
        {module.title}
        {module.isMandatory ? " · Mandatory" : ""}
        {isCompleted ? " · Completed" : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {module.category}
        {module.durationMinutes != null
          ? ` · ${module.durationMinutes} min`
          : ""}
        {module.hasAttachment
          ? ` · Attachment${module.attachmentName ? `: ${module.attachmentName}` : ""}`
          : ""}
      </Text>
      {module.description ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {module.description}
        </Text>
      ) : null}
      {module.externalUrl ? (
        <ExternalLinkButton title={module.title} url={module.externalUrl} />
      ) : null}
      {canComplete && !isCompleted ? (
        <Button
          label="Mark complete"
          pendingLabel="Marking complete…"
          accessibilityLabel={`Mark complete: ${module.title}`}
          pending={isMarkingComplete}
          onPress={() => {
            onMarkComplete(module.id);
          }}
        />
      ) : null}
      {isCompleted ? (
        <StatusMessage tone="success">Completed</StatusMessage>
      ) : null}
    </View>
  );
}

export function LearningScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const allowed = canReadLearning(hasPermission);
  const canComplete = canCompleteLearning(hasPermission);

  const modulesQuery = useQuery({
    queryKey: learningModulesQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listLearningModules(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  const completionsQuery = useQuery({
    queryKey: learningCompletionsQueryKey({ page: 1, limit: 100 }),
    queryFn: ({ signal }) =>
      listLearningCompletions(api, { page: 1, limit: 100 }, signal),
    enabled: allowed && canComplete,
  });

  const markCompleteMutation = useMutation({
    mutationFn: (moduleId: string) =>
      markLearningComplete(api, { moduleId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LEARNING_MODULES_QUERY_ROOT }),
        queryClient.invalidateQueries({
          queryKey: LEARNING_COMPLETIONS_QUERY_ROOT,
        }),
      ]);
    },
  });

  const completedModuleIds = new Set(
    completionsQuery.data?.data.map((completion) => completion.moduleId) ?? [],
  );

  if (!allowed) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Card title="Learning" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view learning modules.
          </StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        paddingBottom: spacing.xxl,
      }}
    >
      <Card title="Learning" maxWidth={720}>
        <Text selectable style={{ color: colors.textMuted }}>
          Browse training modules and mark completed courses when you finish
          them.
        </Text>
      </Card>

      {modulesQuery.isPending ? (
        <LoadingState label="Loading learning modules…" />
      ) : null}

      {modulesQuery.isError ? (
        <Card title="Unable to load learning" maxWidth={720}>
          <StatusMessage tone="error">
            {errorMessage(
              modulesQuery.error,
              "We could not load learning modules.",
            )}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            onPress={() => {
              void modulesQuery.refetch();
            }}
          />
        </Card>
      ) : null}

      {markCompleteMutation.isError ? (
        <Card title="Unable to mark complete" maxWidth={720}>
          <StatusMessage tone="error">
            {errorMessage(
              markCompleteMutation.error,
              "We could not mark this module complete.",
            )}
          </StatusMessage>
        </Card>
      ) : null}

      {modulesQuery.isSuccess && modulesQuery.data.data.length === 0 ? (
        <Card title="No modules" maxWidth={720}>
          <StatusMessage tone="info">
            No active learning modules are available.
          </StatusMessage>
        </Card>
      ) : null}

      {modulesQuery.isSuccess
        ? modulesQuery.data.data.map((module) => (
            <ModuleRow
              key={module.id}
              module={module}
              canComplete={canComplete}
              isCompleted={completedModuleIds.has(module.id)}
              isMarkingComplete={
                markCompleteMutation.isPending &&
                markCompleteMutation.variables === module.id
              }
              onMarkComplete={(moduleId) => {
                markCompleteMutation.mutate(moduleId);
              }}
            />
          ))
        : null}
    </ScrollView>
  );
}
