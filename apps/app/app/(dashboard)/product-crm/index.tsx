import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Product CRM"
      path="/product-crm?limit=50"
      empty="No records yet."
    />
  );
}
