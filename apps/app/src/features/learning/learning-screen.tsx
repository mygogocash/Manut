import {
  ApiError,
  learningModulesQueryKey,
  listLearningModules,
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
import { useQuery } from "@tanstack/react-query";
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

function ModuleRow({ module }: { module: LearningModule }) {
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
        <ExternalLinkButton
          title={module.title}
          url={module.externalUrl}
        />
      ) : null}
    </View>
  );
}

export function LearningScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadLearning(hasPermission);

  const modulesQuery = useQuery({
    queryKey: learningModulesQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listLearningModules(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

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
          Read-only training modules. Manage modules and mark complete stay
          deferred for a later slice.
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

      {modulesQuery.isSuccess && modulesQuery.data.data.length === 0 ? (
        <Card title="No modules" maxWidth={720}>
          <StatusMessage tone="info">
            No active learning modules are available.
          </StatusMessage>
        </Card>
      ) : null}

      {modulesQuery.isSuccess
        ? modulesQuery.data.data.map((module) => (
            <ModuleRow key={module.id} module={module} />
          ))
        : null}
    </ScrollView>
  );
}
