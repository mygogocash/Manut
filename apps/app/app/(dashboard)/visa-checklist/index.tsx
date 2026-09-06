import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Visa Checklist"
      path="/visa-checklist/templates?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
