import {
  ApiError,
  getCashAdvanceItemReceiptUrl,
  type CashAdvanceItemLine,
} from "@manut/app-core";
import { Button, colors, spacing } from "@manut/ui";
import { useMutation } from "@tanstack/react-query";
import { Linking, Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatMoney(amount: number | undefined, currency: string): string {
  if (amount === undefined) return currency;
  return `${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function CashAdvanceLineItems({
  requestId,
  requestNumber,
  currency,
  items,
}: {
  requestId: string;
  requestNumber: number;
  currency: string;
  items: ReadonlyArray<CashAdvanceItemLine>;
}) {
  const api = useApiClient();
  const receiptLines = items.filter((item) => item.hasReceipt);
  const openMutation = useMutation({
    mutationFn: (itemId: string) =>
      getCashAdvanceItemReceiptUrl(api, requestId, itemId),
    onSuccess: async (result) => {
      await Linking.openURL(result.url);
    },
  });

  if (receiptLines.length === 0) {
    return null;
  }

  return (
    <View
      accessibilityLabel={`Line items for CA-${requestNumber}`}
      style={{ gap: spacing.xs }}
    >
      {receiptLines.map((item) => (
        <View
          key={item.id}
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Text selectable style={{ color: colors.textMuted, flexShrink: 1 }}>
            {item.description}
            {item.requestedAmount !== undefined
              ? ` · ${formatMoney(item.requestedAmount, currency)}`
              : ""}
          </Text>
          <Button
            label="View receipt"
            pendingLabel="Opening…"
            accessibilityLabel={`View receipt for ${item.description} on CA-${requestNumber}`}
            pending={
              openMutation.isPending && openMutation.variables === item.id
            }
            disabled={openMutation.isPending}
            onPress={() => {
              openMutation.reset();
              openMutation.mutate(item.id);
            }}
          />
        </View>
      ))}
      {openMutation.isError ? (
        <Text selectable style={{ color: colors.errorText }}>
          {errorMessage(openMutation.error, "Could not open receipt.")}
        </Text>
      ) : null}
    </View>
  );
}
