import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Marketing Campaigns"
      path="/marketing-campaigns/campaigns?page=1&limit=20"
      empty="No campaigns yet."
    />
  );
}
