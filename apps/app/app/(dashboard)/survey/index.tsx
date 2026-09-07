import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Survey"
      path="/survey?scope=available&page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
