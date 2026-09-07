import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="QA CRM"
      path="/qa-crm?limit=50"
      empty="No records yet."
    />
  );
}
