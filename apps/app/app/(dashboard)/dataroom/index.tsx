import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Data Room"
      path="/dataroom?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
