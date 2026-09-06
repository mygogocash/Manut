import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Partners"
      path="/partners?limit=50"
      empty="Nothing here yet."
    />
  );
}
