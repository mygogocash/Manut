import {
  ApiError,
  listVoucherEntries,
  voucherCrmQueryKey,
  type VoucherEntry,
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

function canReadVouchers(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("voucher-crm:read") || hasPermission("voucher-crm:read-all")
  );
}

function VoucherRow({ entry }: { entry: VoucherEntry }) {
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
        {entry.partner}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {entry.country ?? "No country"} · issued {entry.issued} · redeemed{" "}
        {entry.redeemed} · refund {entry.refund}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {entry.creator ? entry.creator.name : "Unassigned"}
      </Text>
    </View>
  );
}

export function VoucherCrmScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadVouchers(hasPermission);

  const vouchersQuery = useQuery({
    queryKey: voucherCrmQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listVoucherEntries(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Voucher CRM" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view voucher CRM.
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
            Voucher CRM
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only voucher list. Create, import, reorder, and edits remain
            later.
          </Text>
        </View>

        {vouchersQuery.isPending ? (
          <LoadingState label="Loading voucher CRM…" />
        ) : null}

        {vouchersQuery.isError ? (
          <Card title="Voucher CRM unavailable">
            <View style={{ gap: spacing.md }}>
              <StatusMessage tone="error">
                {errorMessage(
                  vouchersQuery.error,
                  "Unable to load voucher CRM.",
                )}
              </StatusMessage>
              <Button
                label="Retry"
                pendingLabel="Retrying…"
                accessibilityLabel="Retry voucher CRM"
                pending={vouchersQuery.isFetching}
                onPress={() => {
                  void vouchersQuery.refetch();
                }}
              />
            </View>
          </Card>
        ) : null}

        {vouchersQuery.data ? (
          vouchersQuery.data.data.length === 0 ? (
            <Card title="Voucher CRM">
              <Text selectable style={{ color: colors.textMuted }}>
                No voucher entries yet.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {vouchersQuery.data.data.map((entry) => (
                <VoucherRow key={entry.id} entry={entry} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
