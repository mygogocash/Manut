import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Slot } from "expo-router";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/store/auth";

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

  return (
    <DashboardShell>
      <View style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <Slot />
      </View>
    </DashboardShell>
  );
}
