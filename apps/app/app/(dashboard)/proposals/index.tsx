import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Proposals"
      path="/proposals?limit=50"
      empty="No records yet."
    />
  );
}
