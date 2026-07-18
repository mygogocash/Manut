import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listArticles } from "../src/articles/articles";

const article = {
  id: "clarticle00000000000000001",
  title: "Product launch coverage",
  link: "https://news.example/launch",
  date: "2026-03-15T00:00:00.000Z",
  img: "https://cdn.example/launch.jpg",
  authorId: "11111111-1111-4111-8111-111111111111",
  author: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alex Example",
    email: "alex@manut.example",
  },
  createdAt: "2026-03-15T00:00:00.000Z",
  updatedAt: "2026-03-16T00:00:00.000Z",
};

describe("articles (PR) foundation contracts", () => {
  it("lists PR articles without image or author email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [article],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listArticles(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: article.id,
      title: "Product launch coverage",
      link: "https://news.example/launch",
      date: "2026-03-15",
      author: { id: article.author.id, name: "Alex Example" },
    });
    expect(result.data[0]).not.toHaveProperty("img");
    expect(result.data[0].author).not.toHaveProperty("email");
    expect(get).toHaveBeenCalledWith(
      "/articles?page=1&limit=20",
      undefined,
    );
  });
});
