import {
  ApiError,
  chartOfAccountsQueryKey,
  listChartOfAccounts,
  type AccountType,
  type ChartOfAccount,
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
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadAccounting(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("accounting:read") ||
    hasPermission("accounting:create") ||
    hasPermission("accounting:approve") ||
    hasPermission("accounting:post") ||
    hasPermission("accounting:admin")
  );
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case "asset":
      return "Asset";
    case "liability":
      return "Liability";
    case "equity":
      return "Equity";
    case "revenue":
      return "Revenue";
    case "expense":
      return "Expense";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function AccountRow({ account }: { account: ChartOfAccount }) {
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
        {account.code} · {account.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {accountTypeLabel(account.type)}
        {account.isActive ? "" : " · Inactive"}
        {account.parent ? ` · Parent ${account.parent.code}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {account.entity.name} · Balance {formatMoney(account.balance)}
      </Text>
    </View>
  );
}

const TYPE_FILTERS: Array<{ label: string; value?: AccountType }> = [
  { label: "All" },
  { label: "Asset", value: "asset" },
  { label: "Liability", value: "liability" },
  { label: "Equity", value: "equity" },
  { label: "Revenue", value: "revenue" },
  { label: "Expense", value: "expense" },
];

export function AccountingScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadAccounting(hasPermission);
  const [typeFilter, setTypeFilter] = useState<AccountType | undefined>(
    undefined,
  );

  const accountsQuery = useQuery({
    queryKey: chartOfAccountsQueryKey({
      type: typeFilter,
      sortBy: "code",
      sortOrder: "asc",
    }),
    queryFn: ({ signal }) =>
      listChartOfAccounts(
        api,
        { type: typeFilter, sortBy: "code", sortOrder: "asc" },
        signal,
      ),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Card title="Accounting" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view the chart of accounts.
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
      <Card title="Accounting" maxWidth={720}>
        <Text selectable style={{ color: colors.textMuted }}>
          Read-only chart of accounts. Journals, invoices, bank import, approve,
          and post workflows stay on the web until a later slice.
        </Text>
      </Card>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        }}
      >
        {TYPE_FILTERS.map((filter) => {
          const selected = typeFilter === filter.value;
          return (
            <Pressable
              key={filter.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Filter ${filter.label}`}
              onPress={() => setTypeFilter(filter.value)}
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: spacing.lg,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.borderStrong,
                borderRadius: radii.control,
                backgroundColor: pressed
                  ? colors.canvas
                  : selected
                    ? colors.surfaceRaised
                    : colors.canvas,
              })}
            >
              <Text
                style={{
                  color: selected ? colors.text : colors.textMuted,
                  fontWeight: selected ? "600" : "400",
                }}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {accountsQuery.isPending ? (
        <LoadingState label="Loading accounts…" />
      ) : null}

      {accountsQuery.isError ? (
        <Card title="Unable to load accounts" maxWidth={720}>
          <StatusMessage tone="error">
            {errorMessage(accountsQuery.error, "We could not load accounts.")}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            onPress={() => {
              void accountsQuery.refetch();
            }}
          />
        </Card>
      ) : null}

      {accountsQuery.isSuccess && accountsQuery.data.data.length === 0 ? (
        <Card title="No accounts" maxWidth={720}>
          <Text selectable style={{ color: colors.textMuted }}>
            No chart-of-accounts rows match this filter.
          </Text>
        </Card>
      ) : null}

      {accountsQuery.isSuccess
        ? accountsQuery.data.data.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))
        : null}
    </ScrollView>
  );
}
