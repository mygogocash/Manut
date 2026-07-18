import {
  ApiError,
  leadsQueryKey,
  listLeads,
  type Lead,
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

function canReadSales(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("crm:read") ||
    hasPermission("crm:team-read") ||
    hasPermission("crm:create") ||
    hasPermission("crm:update") ||
    hasPermission("crm:delete")
  );
}

function LeadRow({ lead }: { lead: Lead }) {
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
        {lead.company}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {lead.firstName} {lead.lastName} · {lead.status}
        {lead.source ? ` · ${lead.source}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {lead.owner ? lead.owner.name : "Unassigned"}
      </Text>
    </View>
  );
}

export function SalesScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadSales(hasPermission);

  const leadsQuery = useQuery({
    queryKey: leadsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listLeads(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Sales" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view sales leads.
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
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            Sales
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only leads list. Pipeline, accounts, contacts, and write
            actions remain later.
          </Text>
        </View>

        {leadsQuery.isPending ? <LoadingState label="Loading leads…" /> : null}

        {leadsQuery.isError ? (
          <Card title="Leads unavailable">
            <StatusMessage tone="error">
              {errorMessage(leadsQuery.error, "We could not load leads.")}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry leads"
              pending={leadsQuery.isFetching}
              onPress={() => {
                void leadsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {leadsQuery.data ? (
          leadsQuery.data.data.length === 0 ? (
            <Card title="No leads">
              <Text selectable style={{ color: colors.textMuted }}>
                No leads are available yet.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Leads" style={{ gap: spacing.md }}>
              {leadsQuery.data.data.map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
