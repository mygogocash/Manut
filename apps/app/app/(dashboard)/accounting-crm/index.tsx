import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Accounting CRM"
      path="/accounting-crm?limit=50"
      empty="No records yet."
    />
  );
}
