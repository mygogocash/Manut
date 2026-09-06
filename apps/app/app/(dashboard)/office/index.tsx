import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Offices"
      path="/office/offices"
      empty="No offices yet."
    />
  );
}
