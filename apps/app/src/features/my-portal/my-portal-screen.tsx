import {
  ApiError,
  getLeaveBalances,
  getMyProfile,
  LEAVE_BALANCES_QUERY_KEY,
  MY_PROFILE_QUERY_KEY,
  type LeaveBalance,
  type MyProfile,
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
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

type PortalLink = {
  label: string;
  href:
    | "/leave"
    | "/performance"
    | "/settings"
    | "/directory"
    | "/travel"
    | "/expenses";
  permission: string | null;
};

const PORTAL_LINKS: PortalLink[] = [
  { label: "Leave", href: "/leave", permission: "leave:read" },
  { label: "Travel", href: "/travel", permission: "travel:read" },
  { label: "Expenses", href: "/expenses", permission: "expense:read" },
  {
    label: "Performance",
    href: "/performance",
    permission: "performance:read",
  },
  { label: "Directory", href: "/directory", permission: "directory:read" },
  { label: "Settings", href: "/settings", permission: null },
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function ProfileHeader({ profile }: { profile: MyProfile }) {
  return (
    <Card title={profile.name} description="My Portal">
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.textMuted }}>
          {profile.email}
        </Text>
        {profile.jobTitle ? (
          <Text selectable style={{ color: colors.text }}>
            {profile.jobTitle}
          </Text>
        ) : null}
        {profile.department ? (
          <Text selectable style={{ color: colors.textMuted }}>
            {profile.department}
          </Text>
        ) : null}
        {profile.entity ? (
          <Text selectable style={{ color: colors.textMuted }}>
            {profile.entity.name} ({profile.entity.code})
          </Text>
        ) : null}
        {profile.location ? (
          <Text selectable style={{ color: colors.textMuted }}>
            {profile.location}
          </Text>
        ) : null}
        {profile.roles.length > 0 ? (
          <Text selectable style={{ color: colors.textMuted }}>
            {profile.roles.map((role) => role.name).join(" · ")}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function LeaveBalanceWidgets({ balances }: { balances: LeaveBalance[] }) {
  if (balances.length === 0) {
    return (
      <Card title="Leave balances">
        <Text selectable style={{ color: colors.textMuted }}>
          No leave balances are available yet.
        </Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text
        selectable
        style={{ color: colors.textStrong, fontWeight: "700", fontSize: 18 }}
      >
        Leave balances
      </Text>
      {balances.map((balance) => (
        <Card
          key={balance.id}
          title={balance.leaveType.name}
          description={`${balance.year}`}
        >
          <Text selectable style={{ color: colors.text }}>
            {balance.remaining} days remaining
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {balance.used} used · {balance.entitled} entitled
          </Text>
        </Card>
      ))}
    </View>
  );
}

function PortalLinkGrid({
  links,
  onOpen,
}: {
  links: PortalLink[];
  onOpen: (href: PortalLink["href"]) => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text
        selectable
        style={{ color: colors.textStrong, fontWeight: "700", fontSize: 18 }}
      >
        Shortcuts
      </Text>
      <View style={{ gap: spacing.sm }}>
        {links.map((link) => (
          <Pressable
            key={link.href}
            accessibilityRole="button"
            accessibilityLabel={`Open ${link.label}`}
            onPress={() => onOpen(link.href)}
          >
            <Card title={link.label} description={`Go to ${link.href}`}>
              <Text selectable style={{ color: colors.accent, fontWeight: "700" }}>
                Open
              </Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MyPortalScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canReadLeave = hasPermission("leave:read");
  const profileQuery = useQuery({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn: ({ signal }) => getMyProfile(api, signal),
  });
  const balancesQuery = useQuery({
    queryKey: LEAVE_BALANCES_QUERY_KEY,
    queryFn: ({ signal }) => getLeaveBalances(api, signal),
    enabled: canReadLeave,
  });
  const links = PORTAL_LINKS.filter(
    (link) => link.permission === null || hasPermission(link.permission),
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
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
            My Portal
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Your employee hub for profile, leave, and common self-service
            shortcuts.
          </Text>
        </View>

        {profileQuery.isPending ? (
          <LoadingState label="Loading your portal…" />
        ) : null}

        {profileQuery.isError ? (
          <Card title="Unable to load profile">
            <View style={{ gap: spacing.md }}>
              <StatusMessage tone="error">
                {errorMessage(
                  profileQuery.error,
                  "We could not load your profile.",
                )}
              </StatusMessage>
              <Button
                label="Retry"
                pendingLabel="Retrying…"
                onPress={() => {
                  void profileQuery.refetch();
                }}
              />
            </View>
          </Card>
        ) : null}

        {profileQuery.data ? (
          <ProfileHeader profile={profileQuery.data} />
        ) : null}

        {canReadLeave && balancesQuery.isPending ? (
          <LoadingState label="Loading leave balances…" />
        ) : null}

        {canReadLeave && balancesQuery.isError ? (
          <Card title="Unable to load leave balances">
            <StatusMessage tone="error">
              {errorMessage(
                balancesQuery.error,
                "We could not load leave balances.",
              )}
            </StatusMessage>
          </Card>
        ) : null}

        {canReadLeave && balancesQuery.data ? (
          <LeaveBalanceWidgets balances={balancesQuery.data} />
        ) : null}

        <PortalLinkGrid
          links={links}
          onOpen={(href) => {
            router.push(href);
          }}
        />
      </View>
    </ScrollView>
  );
}
