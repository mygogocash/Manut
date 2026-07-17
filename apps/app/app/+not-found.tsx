import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function NotFoundRoute() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 24,
        backgroundColor: "#f7f4ed",
      }}
    >
      <Text selectable style={{ fontSize: 26, fontWeight: "700" }}>
        Page not found
      </Text>
      <Link href="/" asChild>
        <Pressable
          accessibilityRole="link"
          style={{
            paddingHorizontal: 16,
            paddingVertical: 11,
            borderRadius: 10,
            backgroundColor: "#785f37",
          }}
        >
          <Text selectable style={{ color: "#ffffff", fontWeight: "700" }}>
            Return home
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
