import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/store/auth";

/**
 * Full sidebar + ROUTE_PERMISSIONS port lands as modules arrive.
 * This layout refreshes /api/auth/me and bounces unauthenticated users.
 */
export default function DashboardLayout() {
  const { user, refreshUser } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshUser();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F3EB" }}>
        <ActivityIndicator color="#8B6914" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  return <Stack screenOptions={{ headerShown: true, title: "Intranet" }} />;
}
