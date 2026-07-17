import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";

export function DashboardScreen() {
  const { user, roles, permissions, logout } = useAuth();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, gap: 18, padding: 24 }}
    >
      <View style={{ gap: 5 }}>
        <Text selectable style={{ fontSize: 28, fontWeight: "700" }}>
          Welcome, {user?.name ?? "teammate"}
        </Text>
        <Text selectable style={{ color: "#665f52" }}>
          This dashboard is rendered from the universal Expo route tree.
        </Text>
      </View>

      <View
        style={{
          gap: 10,
          padding: 20,
          borderWidth: 1,
          borderColor: "#ded8ca",
          borderRadius: 16,
          backgroundColor: "#fffdf8",
        }}
      >
        <Text selectable style={{ fontSize: 18, fontWeight: "700" }}>
          Session summary
        </Text>
        <Text selectable>
          Roles: {roles.map((role) => role.name).join(", ") || "None"}
        </Text>
        <Text selectable>
          Permissions loaded: {permissions.length.toLocaleString()}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => void logout()}
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderWidth: 1,
          borderColor: "#a99a82",
          borderRadius: 10,
          backgroundColor: pressed ? "#eee5d5" : "#fffdf8",
        })}
      >
        <Text selectable style={{ fontWeight: "700" }}>
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
  );
}
