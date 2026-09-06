import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Investors"
      path="/investors?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
