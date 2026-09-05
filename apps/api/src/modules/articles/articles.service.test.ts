import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { articlesRepository } from "@/modules/articles/articles.repository";
import { ArticlesService } from "@/modules/articles/articles.service";

vi.mock("./articles.repository", () => ({
  articlesRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAuthor = { id: "user-1", name: "Test Author" };

describe("ArticlesService", () => {
  let articlesService: ArticlesService;

  beforeEach(() => {
    articlesService = new ArticlesService();
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return paginated articles list", async () => {
      const mockArticles = [
        {
          id: "article-1",
          title: "First PR Article",
          date: "2026-04-20",
          link: "https://example.com/article-1",
          img: "https://example.com/img1.jpg",
          authorId: "user-1",
          author: mockAuthor,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (articlesRepository.findAll as Mock).mockResolvedValue([mockArticles, 1]);

      const result = await articlesService.list({
        search: "First",
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("First PR Article");
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(articlesRepository.findAll).toHaveBeenCalledWith({
        search: "First",
        page: 1,
        limit: 20,
      });
    });

    it("should use default pagination params", async () => {
      (articlesRepository.findAll as Mock).mockResolvedValue([[], 0]);

      const result = await articlesService.list();

      expect(result.data).toHaveLength(0);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it("should calculate totalPages correctly", async () => {
      (articlesRepository.findAll as Mock).mockResolvedValue([[], 45]);

      const result = await articlesService.list({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe("getById", () => {
    it("should return article by ID", async () => {
      const mockArticle = {
        id: "article-1",
        title: "Test Article",
        date: "2026-04-20",
        link: "https://example.com/test",
        img: "https://example.com/test.jpg",
        authorId: "user-1",
        author: mockAuthor,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (articlesRepository.findById as Mock).mockResolvedValue(mockArticle);

      const result = await articlesService.getById("article-1");

      expect(result.data.id).toBe("article-1");
      expect(result.data.title).toBe("Test Article");
      expect(result.data.link).toBe("https://example.com/test");
    });

    it("should throw NotFoundException when article not found", async () => {
      (articlesRepository.findById as Mock).mockResolvedValue(null);

      await expect(articlesService.getById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create", () => {
    const createInput = {
      title: "New PR Article",
      link: "https://example.com/new-article",
      date: "2026-04-25",
      img: "https://example.com/new-img.jpg",
    };

    it("should create article successfully", async () => {
      (articlesRepository.create as Mock).mockResolvedValue({
        id: "new-article-1",
        ...createInput,
        authorId: "user-1",
        author: mockAuthor,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await articlesService.create(createInput, "user-1");

      expect(result.data.id).toBe("new-article-1");
      expect(result.data.title).toBe("New PR Article");
      expect(articlesRepository.create).toHaveBeenCalledWith({
        title: "New PR Article",
        link: "https://example.com/new-article",
        date: "2026-04-25",
        img: "https://example.com/new-img.jpg",
        author: { connect: { id: "user-1" } },
      });
    });
  });

  describe("update", () => {
    it("should update article successfully", async () => {
      (articlesRepository.findById as Mock).mockResolvedValue({
        id: "article-1",
        title: "Old Title",
      });
      (articlesRepository.update as Mock).mockResolvedValue({
        id: "article-1",
        title: "Updated Title",
        date: "2026-04-25",
        link: "https://example.com/updated",
        img: "https://example.com/updated.jpg",
        authorId: "user-1",
        author: mockAuthor,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await articlesService.update("article-1", {
        title: "Updated Title",
      });

      expect(result.data.title).toBe("Updated Title");
    });

    it("should throw NotFoundException when article not found", async () => {
      (articlesRepository.findById as Mock).mockResolvedValue(null);

      await expect(
        articlesService.update("non-existent", { title: "Test" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("should delete article successfully", async () => {
      (articlesRepository.findById as Mock).mockResolvedValue({
        id: "article-1",
        title: "To Delete",
      });
      (articlesRepository.delete as Mock).mockResolvedValue(undefined);

      const result = await articlesService.remove("article-1");

      expect(result.data.id).toBe("article-1");
      expect(articlesRepository.delete).toHaveBeenCalledWith("article-1");
    });

    it("should throw NotFoundException when article not found", async () => {
      (articlesRepository.findById as Mock).mockResolvedValue(null);

      await expect(articlesService.remove("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
