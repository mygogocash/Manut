import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Company Dates"
      path="/company-dates?page=1&limit=50"
      empty="No upcoming dates."
    />
  );
}
