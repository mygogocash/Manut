import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { getAppUrl } from "@/lib/env";

type TravelRequest = {
  id: string;
  requestCode: string;
  status: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  employee?: { name: string };
  viewerCanAct?: boolean;
};

type ListResponse = {
  data: TravelRequest[];
  meta?: { page: number; total: number };
};

export default function TravelPage() {
  const [items, setItems] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getAppUrl()}/api/travel/requests`, { credentials: "include" });
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
      <Text style={styles.title}>Travel requests</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.sub}>No travel requests yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.headline}>{item.requestCode}</Text>
            <Text style={styles.meta}>
              {item.origin} → {item.destination}
            </Text>
            <Text style={styles.meta}>
              {item.departureDate} – {item.returnDate} · {item.status}
              {item.viewerCanAct ? " · action required" : ""}
            </Text>
            {item.employee?.name ? <Text style={styles.meta}>{item.employee.name}</Text> : null}
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
