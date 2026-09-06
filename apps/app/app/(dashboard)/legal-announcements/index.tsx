import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Legal Announcements"
      path="/legal-announcements?limit=50"
      empty="No records yet."
    />
  );
}
