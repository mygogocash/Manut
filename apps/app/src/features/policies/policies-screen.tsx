import {
  ApiError,
  listCompanyPolicies,
  policiesQueryKey,
  type CompanyPolicy,
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

function canReadPolicies(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("policy:read") || hasPermission("policy:manage");
}

function PolicyRow({ policy }: { policy: CompanyPolicy }) {
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
        {policy.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {policy.category} · {policy.fileName}
        {policy.version ? ` · v${policy.version}` : ""}
        {policy.isActive ? "" : " · Inactive"}
        {policy.entityName ? ` · ${policy.entityName}` : ""}
      </Text>
    </View>
  );
}

export function PoliciesScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadPolicies(hasPermission);

  const policiesQuery = useQuery({
    queryKey: policiesQueryKey(),
    queryFn: ({ signal }) => listCompanyPolicies(api, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Policies" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view policies.
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
        <Card title="Policies" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only company policy list. Uploads and downloads remain
              deferred.
            </Text>
            {policiesQuery.isLoading ? (
              <LoadingState label="Loading policies…" />
            ) : null}
            {policiesQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    policiesQuery.error,
                    "Unable to load policies.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void policiesQuery.refetch()}
                />
              </View>
            ) : null}
            {policiesQuery.data?.data.length === 0 ? (
              <StatusMessage tone="warning">No policies found.</StatusMessage>
            ) : null}
            {policiesQuery.data?.data.map((policy) => (
              <PolicyRow key={policy.id} policy={policy} />
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
