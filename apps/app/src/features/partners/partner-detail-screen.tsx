import {
  ApiError,
  getPartner,
  partnerDetailQueryKey,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadPartners(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("partners:read") ||
    hasPermission("partners:create") ||
    hasPermission("partners:update") ||
    hasPermission("partners:delete")
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function PartnerDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const params = useLocalSearchParams<{ partnerId?: string }>();
  const partnerId =
    typeof params.partnerId === "string" ? params.partnerId : "";
  const allowed = canReadPartners(hasPermission);

  const detailQuery = useQuery({
    queryKey: partnerDetailQueryKey(partnerId),
    queryFn: ({ signal }) => getPartner(api, partnerId, signal),
    enabled: allowed && partnerId.length > 0,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Partner" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view this partner.
          </StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  if (!partnerId) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Partner" maxWidth={720}>
          <StatusMessage tone="error">Partner id is missing.</StatusMessage>
          <Button label="Back to partners" onPress={() => router.push("/partners")} />
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
        <Button
          label="Back to partners"
          accessibilityLabel="Back to partners"
          onPress={() => router.push("/partners")}
        />

        {detailQuery.isPending ? (
          <LoadingState label="Loading partner…" />
        ) : null}

        {detailQuery.isError ? (
          <Card title="Partner unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                detailQuery.error,
                "We could not load this partner.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry partner"
              pending={detailQuery.isFetching}
              onPress={() => {
                void detailQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {detailQuery.data ? (
          <Card title={detailQuery.data.company} maxWidth={720}>
            <View style={{ gap: spacing.md }}>
              <Text selectable style={{ color: colors.textMuted }}>
                {detailQuery.data.type} · {detailQuery.data.status}
                {detailQuery.data.region ? ` · ${detailQuery.data.region}` : ""}
                {detailQuery.data.country
                  ? ` · ${detailQuery.data.country}`
                  : ""}
              </Text>
              <Text selectable style={{ color: colors.text }}>
                Owner:{" "}
                {detailQuery.data.owner
                  ? detailQuery.data.owner.name
                  : "Unassigned"}
              </Text>
              {detailQuery.data.description ? (
                <Text selectable style={{ color: colors.text }}>
                  {detailQuery.data.description}
                </Text>
              ) : null}
              {detailQuery.data.dependency ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  Dependency: {detailQuery.data.dependency}
                </Text>
              ) : null}
              <Text selectable style={{ color: colors.textMuted }}>
                Projects: {detailQuery.data.projectCount}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                Production live:{" "}
                {formatDate(detailQuery.data.productionLiveDate)}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                Go-live: {formatDate(detailQuery.data.goLiveDate)}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                Revised go-live:{" "}
                {formatDate(detailQuery.data.revisedGoLiveDate)}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                Contracts, contacts, board, and notes remain later.
              </Text>
            </View>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
