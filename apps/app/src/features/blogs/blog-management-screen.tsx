import {
  ApiError,
  blogsQueryKey,
  listBlogs,
  type Blog,
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

function canReadBlogs(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("blog:read") ||
    hasPermission("blog:create") ||
    hasPermission("blog:update") ||
    hasPermission("blog:delete")
  );
}

function BlogRow({ blog }: { blog: Blog }) {
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
        {blog.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {blog.slug ?? "No slug"}
        {blog.active ? " · Active" : " · Inactive"}
        {blog.author ? ` · ${blog.author.name}` : ""}
      </Text>
    </View>
  );
}

export function BlogManagementScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadBlogs(hasPermission);

  const blogsQuery = useQuery({
    queryKey: blogsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listBlogs(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Blog" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view blogs.
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
        <Card title="Blog" maxWidth={720}>
          <Text style={{ color: colors.textMuted }}>
            Read-only post list. Compose and full HTML bodies stay deferred.
          </Text>
        </Card>

        {blogsQuery.isLoading ? <LoadingState label="Loading blogs…" /> : null}

        {blogsQuery.isError ? (
          <StatusMessage tone="error">
            {errorMessage(blogsQuery.error, "Unable to load blogs.")}
          </StatusMessage>
        ) : null}

        {blogsQuery.data ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>
              Posts ({blogsQuery.data.meta.total})
            </Text>
            {blogsQuery.data.data.length === 0 ? (
              <StatusMessage tone="neutral">No blog posts found.</StatusMessage>
            ) : (
              blogsQuery.data.data.map((blog) => (
                <BlogRow key={blog.id} blog={blog} />
              ))
            )}
            {blogsQuery.isFetching ? (
              <Button
                label="Refresh"
                onPress={() => {
                  void blogsQuery.refetch();
                }}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
