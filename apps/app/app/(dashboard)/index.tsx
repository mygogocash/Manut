import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/store/auth";

export default function DashboardHome() {
  const user = useAuth((s) => s.user);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Welcome{user?.name ? `, ${user.name}` : ""}</Text>
      <Text style={styles.sub}>Intranet — modules arrive in later migration waves.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: "#F7F3EB" },
  title: { fontSize: 28, fontWeight: "700", color: "#3D2B1F" },
  sub: { marginTop: 8, color: "#8B7355" },
});
