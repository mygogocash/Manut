import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="IT Operations"
      path="/it-operations/dashboard?limit=50"
      empty="No records yet."
    />
  );
}
