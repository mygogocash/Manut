import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listBlogs } from "../src/blogs/blogs";

const blog = {
  id: "clblog00000000000000000001",
  title: "Intranet update",
  content: "<p>Full HTML body that must not reach the client list</p>",
  coverImage: "https://cdn.example/cover.png",
  slug: "intranet-update",
  active: true,
  authorId: "11111111-1111-4111-8111-111111111111",
  author: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alex Example",
    email: "alex@manut.example",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("blogs foundation contracts", () => {
  it("lists blogs without HTML content or author email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [blog],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listBlogs(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: blog.id,
      title: "Intranet update",
      slug: "intranet-update",
      active: true,
      author: { id: blog.author.id, name: "Alex Example" },
    });
    expect(result.data[0]).not.toHaveProperty("content");
    expect(result.data[0]).not.toHaveProperty("coverImage");
    expect(result.data[0].author).not.toHaveProperty("email");
    expect(get).toHaveBeenCalledWith(
      "/blogs?page=1&limit=20",
      undefined,
    );
  });
});
