import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Company Policies"
      path="/policies"
      empty="No policies yet."
    />
  );
}
