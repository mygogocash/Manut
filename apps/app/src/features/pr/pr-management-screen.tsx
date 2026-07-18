import {
  ApiError,
  articlesQueryKey,
  listArticles,
  type Article,
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
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadPr(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("pr:read") ||
    hasPermission("pr:create") ||
    hasPermission("pr:update") ||
    hasPermission("pr:delete")
  );
}

function ArticleRow({ article }: { article: Article }) {
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
        {article.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {article.date}
        {article.author ? ` · ${article.author.name}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {article.link}
      </Text>
    </View>
  );
}

export function PrManagementScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadPr(hasPermission);

  const articlesQuery = useQuery({
    queryKey: articlesQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listArticles(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="PR" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view PR articles.
          </StatusMessage>
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
        <Card title="PR" maxWidth={720}>
          <Text style={{ color: colors.textMuted }}>
            Read-only coverage list. Create/edit and image assets stay deferred.
          </Text>
        </Card>

        {articlesQuery.isLoading ? (
          <LoadingState label="Loading PR articles…" />
        ) : null}

        {articlesQuery.isError ? (
          <StatusMessage tone="error">
            {errorMessage(articlesQuery.error, "Unable to load PR articles.")}
          </StatusMessage>
        ) : null}

        {articlesQuery.data ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>
              Articles ({articlesQuery.data.meta.total})
            </Text>
            {articlesQuery.data.data.length === 0 ? (
              <StatusMessage tone="neutral">No PR articles found.</StatusMessage>
            ) : (
              articlesQuery.data.data.map((article) => (
                <ArticleRow key={article.id} article={article} />
              ))
            )}
            {articlesQuery.isFetching ? (
              <Button
                label="Refresh"
                onPress={() => {
                  void articlesQuery.refetch();
                }}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
