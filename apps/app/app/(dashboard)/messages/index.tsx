import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Messages"
      path="/messages/channels"
      empty="No channels yet"
      emptyDescription="Conversations you join will appear here."
    />
  );
}
