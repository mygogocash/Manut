import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Docs"
      path="/docs?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
