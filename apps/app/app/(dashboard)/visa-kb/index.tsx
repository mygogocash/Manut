import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Visa Knowledge Base"
      path="/visa-kb?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
