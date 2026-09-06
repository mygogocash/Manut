import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="IT Access"
      path="/it-access?limit=50"
      empty="No records yet."
    />
  );
}
