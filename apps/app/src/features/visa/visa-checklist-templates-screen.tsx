import {
  ApiError,
  listVisaChecklistTemplates,
  VISA_CHECKLIST_TEMPLATES_QUERY_KEY,
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
import { ScrollView, Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load checklist templates.";
}

export function VisaChecklistTemplatesScreen() {
  const api = useApiClient();
  const templatesQuery = useQuery({
    queryKey: VISA_CHECKLIST_TEMPLATES_QUERY_KEY,
    queryFn: ({ signal }) => listVisaChecklistTemplates(api, signal),
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
            Visa checklist templates
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only template list. Item editing and create remain later.
          </Text>
        </View>

        {templatesQuery.isPending ? (
          <LoadingState label="Loading templates…" />
        ) : null}

        {templatesQuery.isError ? (
          <Card title="Templates unavailable">
            <StatusMessage tone="error">
              {errorMessage(templatesQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry checklist templates"
              pending={templatesQuery.isFetching}
              onPress={() => {
                void templatesQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {templatesQuery.data ? (
          templatesQuery.data.length === 0 ? (
            <Card title="No templates">
              <Text selectable style={{ color: colors.textMuted }}>
                No checklist templates are configured yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Visa checklist templates"
              style={{ gap: spacing.md }}
            >
              {templatesQuery.data.map((template) => (
                <Card
                  key={template.id}
                  title={template.name}
                  description={
                    [template.visaType, template.country]
                      .filter(Boolean)
                      .join(" · ") || template.visaType
                  }
                >
                  <Text selectable style={{ color: colors.textMuted }}>
                    {template.isActive ? "Active" : "Inactive"} ·{" "}
                    {template.itemCount} item
                    {template.itemCount === 1 ? "" : "s"}
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
