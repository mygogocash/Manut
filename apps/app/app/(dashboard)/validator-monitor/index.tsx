import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Validator Monitor"
      path="/validator-monitor?limit=50"
      empty="No records yet."
    />
  );
}
