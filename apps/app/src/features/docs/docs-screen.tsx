import {
  ApiError,
  listWikiPages,
  wikiPagesQueryKey,
  type WikiPage,
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

function canReadDocs(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("docs:read") ||
    hasPermission("docs:create") ||
    hasPermission("docs:update") ||
    hasPermission("docs:delete")
  );
}

function WikiPageRow({ page }: { page: WikiPage }) {
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
        {page.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {page.slug}
        {page.folder ? ` · ${page.folder}` : ""}
        {page.isPublished ? " · Published" : " · Draft"}
        {page.isRestricted ? " · Restricted" : ""}
      </Text>
      {page.createdBy ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {page.createdBy.name}
        </Text>
      ) : null}
    </View>
  );
}

export function DocsScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadDocs(hasPermission);

  const docsQuery = useQuery({
    queryKey: wikiPagesQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listWikiPages(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Docs" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view docs.
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
        <Card title="Docs" maxWidth={720}>
          <Text style={{ color: colors.textMuted }}>
            Read-only wiki page list. Page bodies, tree editor, and ACL writes
            stay deferred.
          </Text>
        </Card>

        {docsQuery.isLoading ? <LoadingState label="Loading docs…" /> : null}

        {docsQuery.isError ? (
          <StatusMessage tone="error">
            {errorMessage(docsQuery.error, "Unable to load docs.")}
          </StatusMessage>
        ) : null}

        {docsQuery.data ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>
              Pages ({docsQuery.data.meta.total})
            </Text>
            {docsQuery.data.data.length === 0 ? (
              <StatusMessage tone="neutral">No wiki pages found.</StatusMessage>
            ) : (
              docsQuery.data.data.map((page) => (
                <WikiPageRow key={page.id} page={page} />
              ))
            )}
            {docsQuery.isFetching ? (
              <Button
                label="Refresh"
                onPress={() => {
                  void docsQuery.refetch();
                }}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
