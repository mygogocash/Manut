import { ResourceListPage } from "@/components/resource-list";

type Post = {
  id: string;
  content: string;
  author?: { name?: string };
};

export default function WallPage() {
  return (
    <ResourceListPage<Post>
      title="Company Wall"
      path="/wall?page=1&limit=20"
      empty="No posts yet."
      row={(item) => ({
        title: item.author?.name ?? "Someone",
        body: item.content,
      })}
    />
  );
}
