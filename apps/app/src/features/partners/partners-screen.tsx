import {
  ApiError,
  listPartners,
  partnersQueryKey,
  type Partner,
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
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

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

function PartnerRow({
  partner,
  onOpen,
}: {
  partner: Partner;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open partner ${partner.company}`}
      onPress={onOpen}
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
        {partner.company}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {partner.type} · {partner.status}
        {partner.region ? ` · ${partner.region}` : ""}
        {partner.country ? ` · ${partner.country}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {partner.owner ? partner.owner.name : "Unassigned"} ·{" "}
        {partner.projectCount} project
        {partner.projectCount === 1 ? "" : "s"}
      </Text>
    </Pressable>
  );
}

export function PartnersScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canReadPartners(hasPermission);

  const partnersQuery = useQuery({
    queryKey: partnersQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listPartners(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Partners" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view partners.
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
            Partners
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only partner list. Import, board, contacts, and contract edits
            remain later.
          </Text>
        </View>

        {partnersQuery.isPending ? (
          <LoadingState label="Loading partners…" />
        ) : null}

        {partnersQuery.isError ? (
          <Card title="Partners unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                partnersQuery.error,
                "We could not load partners.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry partners"
              pending={partnersQuery.isFetching}
              onPress={() => {
                void partnersQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {partnersQuery.data ? (
          partnersQuery.data.data.length === 0 ? (
            <Card title="No partners">
              <Text selectable style={{ color: colors.textMuted }}>
                No partners are available yet.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Partners" style={{ gap: spacing.md }}>
              {partnersQuery.data.data.map((partner) => (
                <PartnerRow
                  key={partner.id}
                  partner={partner}
                  onOpen={() => router.push(`/partners/${partner.id}`)}
                />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
