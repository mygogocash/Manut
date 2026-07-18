import {
  ApiError,
  DIRECTORY_LIST_QUERY_ROOT,
  directoryListAccessQueryKey,
  getMyProfile,
  MY_PROFILE_QUERY_KEY,
  updateMyProfile,
  type DirectoryList,
  type MyProfile,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
  SwitchField,
} from "@manut/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { SettingsIntegrationsPanel } from "@/features/settings/settings-integrations-panel";
import { SettingsPreferencesPanel } from "@/features/settings/settings-preferences-panel";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.text, fontWeight: "600" }}>
        {value}
      </Text>
    </View>
  );
}

function ProfileContent({ profile }: { profile: MyProfile }) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const privacyMutation = useMutation({
    mutationFn: (phonePublic: boolean) => updateMyProfile(api, { phonePublic }),
    onSuccess: (updated) => {
      queryClient.setQueryData<MyProfile>(MY_PROFILE_QUERY_KEY, (current) =>
        current ? { ...current, ...updated } : current,
      );
      if (!updated.phonePublic) {
        queryClient.setQueriesData<DirectoryList>(
          { queryKey: directoryListAccessQueryKey("standard") },
          (current) =>
            current
              ? {
                  ...current,
                  data: current.data.map((employee) => {
                    if (employee.id !== updated.id) return employee;
                    const redacted = { ...employee };
                    delete redacted.phone;
                    return redacted;
                  }),
                }
              : current,
        );
      }
      void queryClient.invalidateQueries({
        queryKey: DIRECTORY_LIST_QUERY_ROOT,
      });
    },
  });
  const notice = privacyMutation.isError
    ? {
        tone: "error" as const,
        message: errorMessage(
          privacyMutation.error,
          "Privacy setting was not saved.",
        ),
      }
    : privacyMutation.isSuccess
      ? {
          tone: "success" as const,
          message: privacyMutation.data.phonePublic
            ? "Your phone number is now visible in the directory."
            : "Your phone number is now hidden from the directory.",
        }
      : null;

  const entity = profile.entity
    ? `${profile.entity.name} (${profile.entity.code})`
    : "Not assigned";
  const phoneDescription = profile.phone
    ? `Colleagues will see ${profile.phone}. HR can always see it.`
    : "No phone number is on your profile. HR can always view profile contact details.";

  return (
    <View style={{ width: "100%", maxWidth: 720, gap: spacing.xl }}>
      <Card
        title="Your profile"
        description="Organization-managed account information"
      >
        <View style={{ gap: spacing.lg }}>
          <ProfileValue label="Name" value={profile.name} />
          <ProfileValue label="Email" value={profile.email} />
          <ProfileValue
            label="Department"
            value={profile.department ?? "Not assigned"}
          />
          <ProfileValue
            label="Job title"
            value={profile.jobTitle ?? "Not assigned"}
          />
          <ProfileValue label="Entity" value={entity} />
          <ProfileValue
            label="Phone number"
            value={profile.phone ?? "Not provided"}
          />
        </View>
      </Card>

      <Card
        title="Privacy"
        description="Choose what colleagues outside HR can see"
      >
        <SwitchField
          label="Show my phone number in the directory"
          description={phoneDescription}
          value={profile.phonePublic}
          pending={privacyMutation.isPending}
          onValueChange={(next) => privacyMutation.mutate(next)}
        />
        {notice ? (
          <StatusMessage tone={notice.tone}>{notice.message}</StatusMessage>
        ) : null}
      </Card>

      <Card title="Security" description="Keep your account credentials safe">
        <Button
          label="Change password"
          pendingLabel="Opening…"
          onPress={() => router.push("/change-password")}
        />
      </Card>
    </View>
  );
}

export function SettingsProfileScreen() {
  const api = useApiClient();
  const profileQuery = useQuery({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn: ({ signal }) => getMyProfile(api, signal),
  });

  if (profileQuery.isPending) {
    return <LoadingState label="Loading your profile…" />;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
          padding: spacing.xxl,
          backgroundColor: colors.canvas,
        }}
      >
        <Card title="Settings unavailable">
          <StatusMessage>
            {errorMessage(
              profileQuery.error,
              "We could not load your profile.",
            )}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            accessibilityLabel="Retry profile"
            pending={profileQuery.isFetching}
            onPress={async () => {
              await profileQuery.refetch();
            }}
          />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        gap: spacing.xl,
        padding: spacing.xxl,
        backgroundColor: colors.canvas,
      }}
    >
      <ProfileContent profile={profileQuery.data} />
      <View style={{ width: "100%", maxWidth: 720 }}>
        <SettingsPreferencesPanel />
      </View>
      <View style={{ width: "100%", maxWidth: 720 }}>
        <SettingsIntegrationsPanel />
      </View>
    </ScrollView>
  );
}
