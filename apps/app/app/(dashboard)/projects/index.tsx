import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Projects"
      path="/projects?limit=50"
      empty="Nothing here yet."
    />
  );
}
