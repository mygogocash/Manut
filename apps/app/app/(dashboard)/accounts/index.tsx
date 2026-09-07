import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Accounts"
      path="/accounts?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
