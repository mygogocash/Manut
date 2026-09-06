import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Accounting"
      subtitle="Journal entries"
      path="/accounting/journals?limit=50"
      empty="No journal entries yet."
    />
  );
}
