import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="PR Articles"
      path="/articles?page=1&limit=20"
      empty="No articles yet."
    />
  );
}
