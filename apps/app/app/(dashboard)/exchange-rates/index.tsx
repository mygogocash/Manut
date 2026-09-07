import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Exchange Rates"
      path="/exchange-rates?latestOnly=true"
      empty="Nothing here yet."
    />
  );
}
