import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { getAppUrl } from "@/lib/env";

type Post = {
  id: string;
  content: string;
  author?: { name?: string };
  createdAt?: string;
};

export default function WallPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getAppUrl()}/api/wall?page=1&limit=20`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: Post[] };
        if (!cancelled) setPosts(json.data ?? []);
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
      <Text style={styles.title}>Company Wall</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.sub}>No posts yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.author}>{item.author?.name ?? "Someone"}</Text>
            <Text style={styles.body}>{item.content}</Text>
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
  card: {
    borderBottomWidth: 1,
    borderBottomColor: "#E8DFD2",
    paddingVertical: 14,
    gap: 6,
  },
  author: { fontWeight: "600", color: "#3D2B1F" },
  body: { color: "#5C4A3A", lineHeight: 22 },
});
