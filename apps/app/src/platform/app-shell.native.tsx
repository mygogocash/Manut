import { Link } from "expo-router";
import type { PropsWithChildren } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { allowedShellLinks } from "@/navigation/shell-links";

export function AppShell({ children }: PropsWithChildren) {
  const { permissions, isEmployeeOnly } = useAuth();
  const links = allowedShellLinks(permissions, isEmployeeOnly);

  return (
    <View style={{ flex: 1, backgroundColor: "#f7f4ed" }}>
      <View
        style={{
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#ded8ca",
          backgroundColor: "#fffdf8",
        }}
      >
        <Text selectable style={{ fontSize: 18, fontWeight: "700" }}>
          Manut Intranet
        </Text>
        <ScrollView
          horizontal
          accessibilityLabel="Primary navigation"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href} asChild>
              <Pressable
                accessibilityRole="link"
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 14,
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
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
