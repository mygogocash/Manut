import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Marketing Recap"
      path="/marketing-recap/targets"
      empty="No targets yet."
    />
  );
}
