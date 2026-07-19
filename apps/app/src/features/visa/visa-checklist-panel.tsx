import {
  ApiError,
  getVisaChecklist,
  toggleVisaChecklistItem,
  visaChecklistQueryKey,
  type VisaChecklistItem,
} from "@manut/app-core";
import {
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
  SwitchField,
} from "@manut/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function ChecklistGroup({
  title,
  items,
  busyItemId,
  onToggle,
}: {
  title: string;
  items: VisaChecklistItem[];
  busyItemId: string | null;
  onToggle: (item: VisaChecklistItem, completed: boolean) => void;
}) {
  if (items.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        selectable
        style={{
          color: colors.textMuted,
          fontWeight: "600",
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: 0.4,
        }}
      >
        {title}
      </Text>
      {items.map((item) => (
        <SwitchField
          key={item.id}
          label={item.label}
          description={item.optional ? "Optional" : undefined}
          value={item.completed}
          pending={busyItemId === item.id}
          disabled={busyItemId !== null && busyItemId !== item.id}
          onValueChange={(completed) => onToggle(item, completed)}
        />
      ))}
    </View>
  );
}

export function VisaChecklistPanel({ visaId }: { visaId: string }) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = visaChecklistQueryKey(visaId);

  const checklistQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getVisaChecklist(api, visaId, signal),
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      itemId,
      completed,
    }: {
      itemId: string;
      completed: boolean;
    }) => toggleVisaChecklistItem(api, visaId, itemId, { completed }),
    onMutate: async ({ itemId, completed }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<VisaChecklistItem[]>(queryKey);
      queryClient.setQueryData<VisaChecklistItem[]>(queryKey, (items) =>
        (items ?? []).map((item) =>
          item.id === itemId ? { ...item, completed } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const items = checklistQuery.data ?? [];
  const documents = items.filter((item) => item.category === "document");
  const steps = items.filter((item) => item.category === "step");
  const done = items.filter((item) => item.completed).length;
  const total = items.length;

  if (checklistQuery.isSuccess && total === 0) {
    return null;
  }

  return (
    <Card
      title="Checklist"
      description={
        checklistQuery.isSuccess && total > 0
          ? `${done} of ${total} complete`
          : "Track documents and steps for this visa."
      }
      maxWidth={560}
    >
      {checklistQuery.isPending ? (
        <LoadingState label="Loading checklist…" />
      ) : null}

      {checklistQuery.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            checklistQuery.error,
            "We could not load this checklist.",
          )}
        </StatusMessage>
      ) : null}

      {toggleMutation.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            toggleMutation.error,
            "The checklist item could not be updated.",
          )}
        </StatusMessage>
      ) : null}

      {checklistQuery.isSuccess ? (
        <View
          accessibilityLabel="Visa checklist"
          style={{ gap: spacing.lg }}
        >
          <ChecklistGroup
            title="Documents"
            items={documents}
            busyItemId={
              toggleMutation.isPending
                ? (toggleMutation.variables?.itemId ?? null)
                : null
            }
            onToggle={(item, completed) => {
              toggleMutation.reset();
              toggleMutation.mutate({ itemId: item.id, completed });
            }}
          />
          <ChecklistGroup
            title="Steps"
            items={steps}
            busyItemId={
              toggleMutation.isPending
                ? (toggleMutation.variables?.itemId ?? null)
                : null
            }
            onToggle={(item, completed) => {
              toggleMutation.reset();
              toggleMutation.mutate({ itemId: item.id, completed });
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}
