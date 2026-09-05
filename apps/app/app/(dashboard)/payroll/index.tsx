import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { getAppUrl } from "@/lib/env";

type PayrollRun = {
  id: string;
  period: string;
  status: string;
  totalGross?: number;
  totalNet?: number;
  totalTax?: number;
  entity?: { name: string; code?: string };
};

type ListResponse = {
  data: PayrollRun[];
  meta?: { page: number; total: number };
};

export default function PayrollPage() {
  const [items, setItems] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getAppUrl()}/api/payroll/runs`, { credentials: "include" });
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
      <Text style={styles.title}>Payroll runs</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.sub}>No payroll runs yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.headline}>{item.period}</Text>
            <Text style={styles.meta}>
              {item.entity?.name ?? "Unknown entity"} · {item.status}
            </Text>
            {item.totalNet != null ? (
              <Text style={styles.meta}>
                Net {item.totalNet.toLocaleString()}
                {item.totalGross != null ? ` · Gross ${item.totalGross.toLocaleString()}` : ""}
              </Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: "#faf8f4" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 12, color: "#1a1a1a" },
  error: { color: "#b00020", marginBottom: 8 },
  sub: { color: "#666", marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e8e0d0",
  },
  headline: { fontSize: 16, fontWeight: "600", color: "#1a1a1a" },
  meta: { fontSize: 13, color: "#555", marginTop: 4 },
});
