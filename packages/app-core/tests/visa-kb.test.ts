import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listVisaKbArticles,
  visaKbArticleSchema,
} from "../src/visa/visa-kb";

const article = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  title: "Non-immigrant B overview",
  slug: "non-immigrant-b-overview",
  body: "Internal guidance with personal contact details.",
  country: "TH",
  visaType: "non_immigrant_b",
  tags: ["work"],
  isActive: true,
  createdBy: { id: "u1", name: "HR Desk", email: "hr@manut.example" },
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
};

describe("visa knowledge-base contracts", () => {
  it("projects list fields and strips body plus creator email", () => {
    const parsed = visaKbArticleSchema.parse(article);
    expect(parsed).toEqual({
      id: article.id,
      title: "Non-immigrant B overview",
      slug: "non-immigrant-b-overview",
      country: "TH",
      visaType: "non_immigrant_b",
      tags: ["work"],
      isActive: true,
      updatedAt: article.updatedAt,
    });
    expect(parsed).not.toHaveProperty("body");
    expect(parsed).not.toHaveProperty("createdBy");
  });

  it("lists articles with pagination", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [article],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(listVisaKbArticles(client, {}, signal)).resolves.toMatchObject(
      {
        data: [expect.objectContaining({ title: article.title })],
        meta: { total: 1 },
      },
    );
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/visa-kb?"),
      { signal },
    );
  });
});
