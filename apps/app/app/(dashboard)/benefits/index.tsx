import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Benefits"
      path="/benefits?page=1&limit=50"
      empty="No benefits yet."
    />
  );
}
