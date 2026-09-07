import { ResourceListPage } from "@/components/resource-list";
import { ASSISTANT_DISPLAY_NAME } from "@/lib/brand";

export default function Page() {
  return (
    <ResourceListPage
      title={ASSISTANT_DISPLAY_NAME}
      path="/aria/conversations"
      empty="No conversations yet."
    />
  );
}
