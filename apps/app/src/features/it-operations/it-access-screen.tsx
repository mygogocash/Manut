import {
  ApiError,
  itAccessRequestsQueryKey,
  listAccessRequests,
  type AccessRequest,
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

function canReadAccess(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("it:access:view") ||
    hasPermission("it:access:request") ||
    hasPermission("it:access:manage")
  );
}

function RequestRow({ request }: { request: AccessRequest }) {
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
        #{request.requestNumber} · {request.systemName}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {request.employeeName} · {request.requestedAccessLevel} ·{" "}
        {request.status}
      </Text>
    </View>
  );
}

export function ItAccessScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadAccess(hasPermission);

  const requestsQuery = useQuery({
    queryKey: itAccessRequestsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listAccessRequests(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="IT Access" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view IT access requests.
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
        <Card title="IT Access" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only access request list. Approve, reject, and grant remain
              deferred.
            </Text>
            {requestsQuery.isLoading ? (
              <LoadingState label="Loading access requests…" />
            ) : null}
            {requestsQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    requestsQuery.error,
                    "Unable to load access requests.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void requestsQuery.refetch()}
                />
              </View>
            ) : null}
            {requestsQuery.data?.data.length === 0 ? (
              <StatusMessage tone="warning">No access requests found.</StatusMessage>
            ) : null}
            {requestsQuery.data?.data.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
