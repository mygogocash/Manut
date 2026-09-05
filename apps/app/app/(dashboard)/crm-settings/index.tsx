import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getAppUrl } from "@/lib/env";

type Settings = {
  notifyEmails: string[];
  notifyOnCreate: boolean;
  notifyOwnerOnCreate: boolean;
  notifyOwnerOnStageChange: boolean;
  updatedAt?: string;
};

export default function CrmSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getAppUrl()}/api/crm/settings`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: Settings };
        if (!cancelled) setSettings(json.data ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#8B6914" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>CRM Settings</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {settings ? (
        <View style={styles.card}>
          <Text style={styles.row}>Notify on create: {settings.notifyOnCreate ? "Yes" : "No"}</Text>
          <Text style={styles.row}>Notify owner on create: {settings.notifyOwnerOnCreate ? "Yes" : "No"}</Text>
          <Text style={styles.row}>Notify owner on stage change: {settings.notifyOwnerOnStageChange ? "Yes" : "No"}</Text>
          <Text style={styles.row}>Recipients: {settings.notifyEmails.length ? settings.notifyEmails.join(", ") : "None"}</Text>
        </View>
      ) : (
        <Text style={styles.sub}>No settings loaded.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: "#F7F3EB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F3EB" },
  title: { fontSize: 28, fontWeight: "700", color: "#3D2B1F", marginBottom: 16 },
  sub: { color: "#8B7355" },
  error: { color: "#B42318", marginBottom: 12 },
  card: { gap: 8 },
  row: { fontSize: 16, color: "#3D2B1F" },
});
