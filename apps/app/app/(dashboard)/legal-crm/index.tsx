import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Legal CRM"
      path="/legal-crm?limit=50"
      empty="No records yet."
    />
  );
}
