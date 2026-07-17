import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { deleteFile } from "@/infrastructure/storage/supabase-storage";
import { articlesRepository } from "@/modules/articles/articles.repository";
import { ArticlesService } from "@/modules/articles/articles.service";
import { arrayAt } from "@/test-utils/assertions";

const storageTestState = vi.hoisted(() => {
  const previousNextPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousSupabaseUrl = process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://manut.supabase.co";
  process.env.SUPABASE_URL = "https://manut.supabase.co";

  return {
    deleteFile: vi.fn().mockResolvedValue(undefined),
    previousNextPublicUrl,
    previousSupabaseUrl,
  };
});

vi.mock("@/infrastructure/storage/supabase-storage", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, deleteFile: storageTestState.deleteFile };
});

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
const ARTICLE_IMAGE_URL =
  "https://manut.supabase.co/storage/v1/object/public/article/articles/old.jpg";
const UNTRUSTED_ARTICLE_IMAGE_URLS = [
  [
    "a foreign origin",
    "https://attacker.example/storage/v1/object/public/article/articles/old.jpg",
  ],
  [
    "another storage bucket",
    "https://manut.supabase.co/storage/v1/object/public/documents/legal/contract.pdf",
  ],
] as const;

afterAll(() => {
  if (storageTestState.previousNextPublicUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      storageTestState.previousNextPublicUrl;
  }
  if (storageTestState.previousSupabaseUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = storageTestState.previousSupabaseUrl;
  }
});

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
      expect(arrayAt(result.data, 0, "listed article").title).toBe(
        "First PR Article",
      );
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

    it.each(UNTRUSTED_ARTICLE_IMAGE_URLS)(
      "does not delete the replaced image from %s",
      async (_source, img) => {
        (articlesRepository.findById as Mock).mockResolvedValue({
          id: "article-1",
          img,
        });
        (articlesRepository.update as Mock).mockResolvedValue({
          id: "article-1",
          img: "https://example.com/replacement.jpg",
        });

        await articlesService.update("article-1", {
          img: "https://example.com/replacement.jpg",
        });

        expect(deleteFile).not.toHaveBeenCalled();
      },
    );

    it("does not automatically delete even a trusted replaced image", async () => {
      (articlesRepository.findById as Mock).mockResolvedValue({
        id: "article-1",
        img: ARTICLE_IMAGE_URL,
      });
      (articlesRepository.update as Mock).mockResolvedValue({
        id: "article-1",
        img: "https://example.com/replacement.jpg",
      });

      await articlesService.update("article-1", {
        img: "https://example.com/replacement.jpg",
      });

      expect(deleteFile).not.toHaveBeenCalled();
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

    it.each(UNTRUSTED_ARTICLE_IMAGE_URLS)(
      "does not delete the stored image from %s",
      async (_source, img) => {
        (articlesRepository.findById as Mock).mockResolvedValue({
          id: "article-1",
          img,
        });

        await articlesService.remove("article-1");

        expect(deleteFile).not.toHaveBeenCalled();
        expect(articlesRepository.delete).toHaveBeenCalledWith("article-1");
      },
    );

    it("removes the record without automatically deleting its stored image", async () => {
      (articlesRepository.findById as Mock).mockResolvedValue({
        id: "article-1",
        img: ARTICLE_IMAGE_URL,
      });

      await articlesService.remove("article-1");

      expect(deleteFile).not.toHaveBeenCalled();
      expect(articlesRepository.delete).toHaveBeenCalledWith("article-1");
    });
  });
});
