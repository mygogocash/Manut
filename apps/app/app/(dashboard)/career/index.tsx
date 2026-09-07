import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Careers"
      path="/career?page=1&limit=50"
      empty="Nothing here yet."
    />
  );
}
