import { Card, spacing } from "@manut/ui";
import { ScrollView } from "react-native";

interface FoundationPageProps {
  title: string;
  description: string;
}

export function FoundationPage({ title, description }: FoundationPageProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, padding: spacing.xxl }}
    >
      <Card title={title} description={description} />
    </ScrollView>
  );
}
