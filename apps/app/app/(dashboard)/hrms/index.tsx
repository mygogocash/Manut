import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { getAppUrl } from "@/lib/env";

type OnboardingRow = {
  id: string;
  employeeName?: string;
  status?: string;
  startDate?: string;
  department?: string;
};

type ListResponse = {
  data: OnboardingRow[];
  meta?: { page: number; total: number };
};

export default function HrmsPage() {
  const [items, setItems] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getAppUrl()}/api/hrms/onboarding`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ListResponse;
        if (!cancelled) setItems(json.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      <Text style={styles.title}>HRMS onboarding</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.sub}>No onboarding records yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.headline}>{item.employeeName ?? item.id}</Text>
            <Text style={styles.meta}>
              {[item.department, item.status, item.startDate].filter(Boolean).join(" · ") || "—"}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: "#faf8f4" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf8f4" },
  title: { fontSize: 22, fontWeight: "600", color: "#1a1a1a", marginBottom: 12 },
  sub: { color: "#666", marginTop: 8 },
  error: { color: "#b00020", marginBottom: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e8e0d4",
  },
  headline: { fontSize: 16, fontWeight: "500", color: "#1a1a1a" },
  meta: { fontSize: 13, color: "#666", marginTop: 4 },
});
