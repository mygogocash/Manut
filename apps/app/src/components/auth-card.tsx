import { Card, colors, spacing } from "@manut/ui";
import type { ReactNode } from "react";
import { ScrollView } from "react-native";

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xxl,
        backgroundColor: colors.canvas,
      }}
    >
      <Card
        title={title}
        description={description}
        maxWidth={440}
        style={{ gap: spacing.lg }}
      >
        {children}
      </Card>
    </ScrollView>
  );
}
