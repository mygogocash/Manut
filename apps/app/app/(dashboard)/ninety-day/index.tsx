import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="90-Day Notifications"
      path="/ninety-day-notifications?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
