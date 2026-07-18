import {
  ApiError,
  applicationsQueryKey,
  listApplications,
  type Application,
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

function canReadApplications(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("application:read") || hasPermission("application:delete")
  );
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        void Linking.openURL(url);
      }}
    >
      <Text style={{ color: colors.accent, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function ApplicationRow({ application }: { application: Application }) {
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
        {application.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {application.job.title} · {application.job.department} ·{" "}
        {application.job.location}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {application.email} · {application.mobile}
        {application.hasResume ? " · Resume on file" : ""}
      </Text>
      {application.linkedin ? (
        <ExternalLink label="Open LinkedIn" url={application.linkedin} />
      ) : null}
      {application.website ? (
        <ExternalLink label="Open website" url={application.website} />
      ) : null}
    </View>
  );
}

export function ApplicationsScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadApplications(hasPermission);

  const applicationsQuery = useQuery({
    queryKey: applicationsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listApplications(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Card title="Applications" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view applications.
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
      <Card title="Applications" maxWidth={720}>
        <Text selectable style={{ color: colors.textMuted }}>
          Read-only recruiter inbox. Status writes, resume download, and delete
          stay deferred for a later slice.
        </Text>
      </Card>

      {applicationsQuery.isPending ? (
        <LoadingState label="Loading applications…" />
      ) : null}

      {applicationsQuery.isError ? (
        <Card title="Unable to load applications" maxWidth={720}>
          <StatusMessage tone="error">
            {errorMessage(
              applicationsQuery.error,
              "We could not load applications.",
            )}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            onPress={() => {
              void applicationsQuery.refetch();
            }}
          />
        </Card>
      ) : null}

      {applicationsQuery.isSuccess &&
      applicationsQuery.data.data.length === 0 ? (
        <Card title="No applications" maxWidth={720}>
          <StatusMessage tone="info">
            No applications match this view.
          </StatusMessage>
        </Card>
      ) : null}

      {applicationsQuery.isSuccess
        ? applicationsQuery.data.data.map((application) => (
            <ApplicationRow key={application.id} application={application} />
          ))
        : null}
    </ScrollView>
  );
}
