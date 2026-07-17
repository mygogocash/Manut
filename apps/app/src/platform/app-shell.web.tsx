import { Link } from "expo-router";
import type { PropsWithChildren } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { allowedShellLinks } from "@/navigation/shell-links";

export function AppShell({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const { permissions, isEmployeeOnly } = useAuth();
  const compact = width < 760;
  const links = allowedShellLinks(permissions, isEmployeeOnly);

  return (
    <View
      style={{
        flex: 1,
        flexDirection: compact ? "column" : "row",
        backgroundColor: "#f7f4ed",
      }}
    >
      <View
        style={{
          width: compact ? "100%" : 224,
          padding: compact ? 14 : 20,
          gap: 10,
          borderRightWidth: compact ? 0 : 1,
          borderRightColor: "#ded8ca",
          borderBottomWidth: compact ? 1 : 0,
          borderBottomColor: "#ded8ca",
          backgroundColor: "#fffdf8",
        }}
      >
        <Text selectable style={{ fontSize: 20, fontWeight: "700" }}>
          Manut Intranet
        </Text>
        <Text selectable style={{ color: "#665f52", marginBottom: 14 }}>
          Universal web foundation
        </Text>
        <ScrollView
          horizontal={compact}
          accessibilityLabel="Primary navigation"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: compact ? "row" : "column",
            gap: 8,
          }}
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href} asChild>
              <Pressable
                accessibilityRole="link"
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: pressed ? "#e5dbc8" : "#f1eadc",
                })}
              >
                <Text
                  selectable
                  style={{ color: "#392f22", fontWeight: "600" }}
                >
                  {link.label}
                </Text>
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}
