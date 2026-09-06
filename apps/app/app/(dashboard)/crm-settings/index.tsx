import { ActivityIndicator, View } from "react-native";
import { PageScreen } from "@/components/page-screen";
import { Text } from "@/components/ui/text";
import { useApiQuery } from "@/hooks/use-api-query";
import { queryKeys } from "@/lib/query-keys";

type Settings = {
  notifyEmails: string[];
  notifyOnCreate: boolean;
  notifyOwnerOnCreate: boolean;
  notifyOwnerOnStageChange: boolean;
};

type SettingsResponse = Settings | { data: Settings };

function unwrapSettings(body: SettingsResponse | undefined): Settings | null {
  if (!body) return null;
  if ("notifyEmails" in body) return body;
  if ("data" in body && body.data) return body.data;
  return null;
}

export default function CrmSettingsPage() {
  const query = useApiQuery<SettingsResponse>(queryKeys.resource("/crm/settings"), "/crm/settings");
  const settings = unwrapSettings(query.data);

  if (query.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#8B6B3D" />
      </View>
    );
  }

  return (
    <PageScreen title="CRM Settings">
      {query.error ? <Text className="mb-3 text-destructive">{query.error.message}</Text> : null}
      {settings ? (
        <View className="gap-2 rounded-xl border border-border bg-card px-4 py-4">
          <Text className="text-[15px] text-foreground">Notify on create: {settings.notifyOnCreate ? "Yes" : "No"}</Text>
          <Text className="text-[15px] text-foreground">
            Notify owner on create: {settings.notifyOwnerOnCreate ? "Yes" : "No"}
          </Text>
          <Text className="text-[15px] text-foreground">
            Notify owner on stage change: {settings.notifyOwnerOnStageChange ? "Yes" : "No"}
          </Text>
          <Text className="text-[15px] text-foreground">
            Recipients: {settings.notifyEmails.length ? settings.notifyEmails.join(", ") : "None"}
          </Text>
        </View>
      ) : (
        <Text className="text-sm text-muted-foreground">No settings loaded.</Text>
      )}
    </PageScreen>
  );
}
