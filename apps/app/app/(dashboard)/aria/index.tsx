import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="ARIA"
      path="/aria/conversations"
      empty="No conversations yet."
    />
  );
}
