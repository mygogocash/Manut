import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="IT CRM"
      path="/it-crm?limit=50"
      empty="No records yet."
    />
  );
}
