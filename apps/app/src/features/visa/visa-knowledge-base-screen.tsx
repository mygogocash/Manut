import {
  ApiError,
  listVisaKbArticles,
  visaKbArticlesQueryKey,
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
import { ScrollView, Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load the visa knowledge base.";
}

export function VisaKnowledgeBaseScreen() {
  const api = useApiClient();
  const articlesQuery = useQuery({
    queryKey: visaKbArticlesQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listVisaKbArticles(api, { page: 1, limit: 20 }, signal),
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
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            Visa knowledge base
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only article list for immigration guidance. Article body,
            create, and edit remain later.
          </Text>
        </View>

        {articlesQuery.isPending ? (
          <LoadingState label="Loading articles…" />
        ) : null}

        {articlesQuery.isError ? (
          <Card title="Knowledge base unavailable">
            <StatusMessage tone="error">
              {errorMessage(articlesQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry visa knowledge base"
              pending={articlesQuery.isFetching}
              onPress={() => {
                void articlesQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {articlesQuery.data ? (
          articlesQuery.data.data.length === 0 ? (
            <Card title="No articles">
              <Text selectable style={{ color: colors.textMuted }}>
                No knowledge-base articles are published yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Visa knowledge-base articles"
              style={{ gap: spacing.md }}
            >
              {articlesQuery.data.data.map((article) => (
                <Card
                  key={article.id}
                  title={article.title}
                  description={
                    [article.country, article.visaType]
                      .filter(Boolean)
                      .join(" · ") || article.slug
                  }
                >
                  <Text selectable style={{ color: colors.textMuted }}>
                    {article.isActive ? "Active" : "Inactive"}
                    {article.tags.length > 0
                      ? ` · ${article.tags.join(", ")}`
                      : ""}
                  </Text>
                </Card>
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
