import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Blogs"
      path="/blogs?page=1&limit=20"
      empty="No blogs yet."
    />
  );
}
