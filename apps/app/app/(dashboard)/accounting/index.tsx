import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { getAppUrl } from "@/lib/env";

type JournalRow = {
  id: string;
  entryNo?: string | null;
  draftNo?: string | null;
  date: string;
  status: string;
  description?: string | null;
};

type ListResponse = {
  data: JournalRow[];
  meta?: { page: number; total: number };
};

export default function AccountingPage() {
  const [items, setItems] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getAppUrl()}/api/accounting/journals?limit=50`, {
          credentials: "include",
        });
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
      <Text style={styles.title}>Accounting</Text>
      <Text style={styles.sub}>Journal entries (edge preview)</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.sub}>No journal entries yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.headline}>{item.entryNo ?? item.draftNo ?? item.id}</Text>
            <Text style={styles.meta}>
              {item.date} · {item.status}
              {item.description ? ` · ${item.description}` : ""}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: "#F7F3EB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F3EB" },
  title: { fontSize: 28, fontWeight: "700", color: "#3D2B1F", marginBottom: 4 },
  sub: { color: "#8B7355", marginBottom: 16 },
  error: { color: "#B42318", marginBottom: 12 },
  card: { borderBottomWidth: 1, borderBottomColor: "#E8DFD2", paddingVertical: 14, gap: 4 },
  headline: { fontSize: 18, fontWeight: "600", color: "#3D2B1F" },
  meta: { color: "#8B7355", fontSize: 13 },
});
