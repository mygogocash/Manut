import { ResourceListPage } from "@/components/resource-list";

type NewsItem = {
  id: string;
  title: string;
  content: string;
  author?: { name?: string };
  isPinned?: boolean;
};

export default function NewsPage() {
  return (
    <ResourceListPage<NewsItem>
      title="Company News"
      path="/news?page=1&limit=20"
      empty="No news yet."
      row={(item) => ({
        title: `${item.isPinned ? "📌 " : ""}${item.title}`,
        meta: item.author?.name ?? "Manut",
        body: item.content,
      })}
    />
  );
}
