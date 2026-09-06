import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="IT Billing"
      path="/it-billing?limit=50"
      empty="No records yet."
    />
  );
}
