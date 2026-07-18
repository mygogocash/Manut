import {
  ApiError,
  leaveCalendarQueryKey,
  listLeaveCalendar,
  type LeaveCalendarEntry,
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
import { Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load the leave calendar.";
}

function monthRangeUtc(now = new Date()): { from: string; to: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0));
  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function formatEntryRange(entry: LeaveCalendarEntry): string {
  if (entry.startDate === entry.endDate) {
    return entry.startDate;
  }
  return `${entry.startDate} – ${entry.endDate}`;
}

export function LeaveCalendarSection() {
  const api = useApiClient();
  const range = monthRangeUtc();
  const calendarQuery = useQuery({
    queryKey: leaveCalendarQueryKey(range),
    queryFn: ({ signal }) => listLeaveCalendar(api, range, signal),
  });

  return (
    <Card
      title="Team leave calendar"
      description={`Approved and pending leave for ${range.from} through ${range.to}.`}
      maxWidth={1080}
    >
      {calendarQuery.isPending ? (
        <LoadingState label="Loading leave calendar…" />
      ) : null}

      {calendarQuery.isError ? (
        <View style={{ gap: spacing.md }}>
          <StatusMessage tone="error">
            {errorMessage(calendarQuery.error)}
          </StatusMessage>
          <Button
            label="Retry calendar"
            pendingLabel="Retrying…"
            accessibilityLabel="Retry leave calendar"
            pending={calendarQuery.isFetching}
            onPress={() => {
              void calendarQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {calendarQuery.data ? (
        calendarQuery.data.length === 0 ? (
          <Text selectable style={{ color: colors.textMuted }}>
            No team leave overlaps this month.
          </Text>
        ) : (
          <View
            accessibilityLabel="Leave calendar entries"
            style={{ gap: spacing.md }}
          >
            {calendarQuery.data.map((entry) => (
              <View key={entry.id} style={{ gap: spacing.xs }}>
                <Text
                  selectable
                  style={{ fontWeight: "600", color: colors.text }}
                >
                  {entry.employee.name} · {entry.leaveType.name}
                </Text>
                <Text selectable style={{ color: colors.textMuted }}>
                  {formatEntryRange(entry)} · {entry.status}
                  {entry.employee.department
                    ? ` · ${entry.employee.department}`
                    : ""}
                </Text>
              </View>
            ))}
          </View>
        )
      ) : null}
    </Card>
  );
}
