import {
  ApiError,
  holidaysQueryKey,
  listHolidays,
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
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load public holidays.";
}

function currentYear(): number {
  return new Date().getUTCFullYear();
}

export function LeaveHolidaysScreen() {
  const api = useApiClient();
  const [year, setYear] = useState(currentYear());
  const holidaysQuery = useQuery({
    queryKey: holidaysQueryKey({ year, page: 1, limit: 100 }),
    queryFn: ({ signal }) =>
      listHolidays(api, { year, page: 1, limit: 100 }, signal),
  });

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
            Public holidays
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only holiday calendar for {year}. Create and edit remain on the
            admin web tools for now.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button
            label="Previous year"
            pendingLabel="Loading…"
            accessibilityLabel="Previous holiday year"
            onPress={() => setYear((current) => current - 1)}
          />
          <Button
            label="Next year"
            pendingLabel="Loading…"
            accessibilityLabel="Next holiday year"
            onPress={() => setYear((current) => current + 1)}
          />
        </View>

        {holidaysQuery.isPending ? (
          <LoadingState label="Loading holidays…" />
        ) : null}

        {holidaysQuery.isError ? (
          <Card title="Holidays unavailable">
            <StatusMessage tone="error">
              {errorMessage(holidaysQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry holidays"
              pending={holidaysQuery.isFetching}
              onPress={() => {
                void holidaysQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {holidaysQuery.data ? (
          holidaysQuery.data.data.length === 0 ? (
            <Card title="No holidays">
              <Text selectable style={{ color: colors.textMuted }}>
                No public holidays are recorded for {year}.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Public holiday list"
              style={{ gap: spacing.md }}
            >
              {holidaysQuery.data.data.map((holiday) => (
                <Card
                  key={holiday.id}
                  title={holiday.name}
                  description={`${holiday.date} · ${holiday.entity.name}`}
                >
                  <Text selectable style={{ color: colors.textMuted }}>
                    {holiday.isActive ? "Active" : "Inactive"}
                    {holiday.notes ? ` · ${holiday.notes}` : ""}
                  </Text>
                </Card>
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
