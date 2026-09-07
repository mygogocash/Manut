import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Opportunities"
      path="/opportunities?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
