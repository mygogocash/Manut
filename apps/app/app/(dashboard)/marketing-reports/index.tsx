import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Marketing Reports"
      path="/marketing-reports/dashboard?days=30"
      empty="No metrics yet."
    />
  );
}
