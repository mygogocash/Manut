import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { getAppUrl } from "@/lib/env";

type CashAdvanceRequest = {
  id: string;
  requestNumber: number;
  status: string;
  currency: string;
  requestedTotal: number;
  employee?: { name: string } | null;
};

type ListResponse = {
  data: CashAdvanceRequest[];
  meta?: { page: number; total: number };
};

export default function CashAdvancePage() {
  const [items, setItems] = useState<CashAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getAppUrl()}/api/cash-advance`, { credentials: "include" });
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
      <Text style={styles.title}>Cash Advance</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.sub}>No requests yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.headline}>CA-{item.requestNumber}</Text>
            <Text style={styles.meta}>
              {item.status} · {item.currency} {item.requestedTotal.toLocaleString()}
              {item.employee?.name ? ` · ${item.employee.name}` : ""}
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
  title: { fontSize: 28, fontWeight: "700", color: "#3D2B1F", marginBottom: 16 },
  sub: { color: "#8B7355" },
  error: { color: "#B42318", marginBottom: 12 },
  card: { borderBottomWidth: 1, borderBottomColor: "#E8DFD2", paddingVertical: 14, gap: 4 },
  headline: { fontSize: 18, fontWeight: "600", color: "#3D2B1F" },
  meta: { color: "#8B7355", fontSize: 13 },
});
