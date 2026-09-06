import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Learning"
      path="/learning/modules?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
