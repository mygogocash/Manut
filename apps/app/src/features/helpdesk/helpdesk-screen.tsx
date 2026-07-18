import {
  ApiError,
  helpdeskTicketsQueryKey,
  helpdeskTicketStatusLabel,
  listHelpdeskTickets,
  type HelpdeskTicket,
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

function canReadHelpdesk(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("it:read") ||
    hasPermission("it:read-all") ||
    hasPermission("it:create")
  );
}

function TicketRow({ ticket }: { ticket: HelpdeskTicket }) {
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
        #{ticket.ticketNumber} · {ticket.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {helpdeskTicketStatusLabel(ticket.status)} · {ticket.priority} ·{" "}
        {ticket.category}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {ticket.createdBy.name}
        {ticket.assignee ? ` · Assigned to ${ticket.assignee.name}` : ""}
      </Text>
    </View>
  );
}

export function HelpdeskScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadHelpdesk(hasPermission);
  const scope = hasPermission("it:read-all") ? "all" : "mine";

  const ticketsQuery = useQuery({
    queryKey: helpdeskTicketsQueryKey({ page: 1, limit: 20, scope }),
    queryFn: ({ signal }) =>
      listHelpdeskTickets(api, { page: 1, limit: 20, scope }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="IT Helpdesk" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view helpdesk tickets.
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
            IT Helpdesk
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only ticket list
            {scope === "all" ? " (team queue)" : " (your tickets)"}. Create,
            status updates, comments, and GitHub sync remain later.
          </Text>
        </View>

        {ticketsQuery.isPending ? (
          <LoadingState label="Loading tickets…" />
        ) : null}

        {ticketsQuery.isError ? (
          <Card title="Tickets unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                ticketsQuery.error,
                "We could not load helpdesk tickets.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry helpdesk tickets"
              pending={ticketsQuery.isFetching}
              onPress={() => {
                void ticketsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {ticketsQuery.data ? (
          ticketsQuery.data.data.length === 0 ? (
            <Card title="No tickets">
              <Text selectable style={{ color: colors.textMuted }}>
                No helpdesk tickets match this view yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Helpdesk tickets"
              style={{ gap: spacing.md }}
            >
              {ticketsQuery.data.data.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
