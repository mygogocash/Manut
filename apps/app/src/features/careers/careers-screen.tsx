import {
  ApiError,
  careerJobsQueryKey,
  listCareerJobs,
  type CareerJob,
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

function canReadCareers(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("career:read") ||
    hasPermission("career:create") ||
    hasPermission("career:update") ||
    hasPermission("career:delete")
  );
}

function jobTypeLabel(type: string): string {
  switch (type) {
    case "full_time":
      return "Full time";
    case "part_time":
      return "Part time";
    case "contract":
      return "Contract";
    case "intern":
      return "Intern";
    default:
      return type.replaceAll("_", " ");
  }
}

function JobRow({ job }: { job: CareerJob }) {
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
        {job.title}
        {job.active ? "" : " · Closed"}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {job.department} · {job.location} · {jobTypeLabel(job.type)}
        {` · ${job.applicationCount} application(s)`}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {job.description}
      </Text>
    </View>
  );
}

export function CareersScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadCareers(hasPermission);

  const jobsQuery = useQuery({
    queryKey: careerJobsQueryKey({ page: 1, limit: 20, active: true }),
    queryFn: ({ signal }) =>
      listCareerJobs(api, { page: 1, limit: 20, active: true }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Card title="Careers" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view job postings.
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
      <Card title="Careers" maxWidth={720}>
        <Text selectable style={{ color: colors.textMuted }}>
          Read-only open job postings. Apply flows and posting manage stay
          deferred for a later slice.
        </Text>
      </Card>

      {jobsQuery.isPending ? (
        <LoadingState label="Loading job postings…" />
      ) : null}

      {jobsQuery.isError ? (
        <Card title="Unable to load careers" maxWidth={720}>
          <StatusMessage tone="error">
            {errorMessage(
              jobsQuery.error,
              "We could not load job postings.",
            )}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            onPress={() => {
              void jobsQuery.refetch();
            }}
          />
        </Card>
      ) : null}

      {jobsQuery.isSuccess && jobsQuery.data.data.length === 0 ? (
        <Card title="No open roles" maxWidth={720}>
          <StatusMessage tone="info">
            No active job postings are available.
          </StatusMessage>
        </Card>
      ) : null}

      {jobsQuery.isSuccess
        ? jobsQuery.data.data.map((job) => <JobRow key={job.id} job={job} />)
        : null}
    </ScrollView>
  );
}
