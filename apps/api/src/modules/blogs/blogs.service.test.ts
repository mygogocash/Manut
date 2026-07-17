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
import { blogsRepository } from "@/modules/blogs/blogs.repository";
import { BlogsService } from "@/modules/blogs/blogs.service";
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

vi.mock("./blogs.repository", () => ({
  blogsRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAuthor = { id: "user-1", name: "Test Author" };
const BLOG_COVER_URL =
  "https://manut.supabase.co/storage/v1/object/public/blog/covers/old.jpg";
const UNTRUSTED_BLOG_COVER_URLS = [
  [
    "a foreign origin",
    "https://attacker.example/storage/v1/object/public/blog/covers/old.jpg",
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

describe("BlogsService", () => {
  let blogsService: BlogsService;

  beforeEach(() => {
    blogsService = new BlogsService();
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return paginated blogs list", async () => {
      const mockBlogs = [
        {
          id: "blog-1",
          title: "First Blog",
          content: "Hello world",
          coverImage: "https://example.com/img.jpg",
          slug: "first-blog",
          active: true,
          authorId: "user-1",
          author: mockAuthor,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (blogsRepository.findAll as Mock).mockResolvedValue([mockBlogs, 1]);

      const result = await blogsService.list({
        search: "First",
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(arrayAt(result.data, 0, "listed blog").title).toBe("First Blog");
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(blogsRepository.findAll).toHaveBeenCalledWith({
        search: "First",
        page: 1,
        limit: 20,
      });
    });

    it("should use default pagination params", async () => {
      (blogsRepository.findAll as Mock).mockResolvedValue([[], 0]);

      const result = await blogsService.list();

      expect(result.data).toHaveLength(0);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });

  describe("getById", () => {
    it("should return blog by ID", async () => {
      const mockBlog = {
        id: "blog-1",
        title: "Test Blog",
        content: "Content here",
        coverImage: "https://example.com/img.jpg",
        slug: "test-blog",
        active: true,
        authorId: "user-1",
        author: mockAuthor,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (blogsRepository.findById as Mock).mockResolvedValue(mockBlog);

      const result = await blogsService.getById("blog-1");

      expect(result.data.id).toBe("blog-1");
      expect(result.data.title).toBe("Test Blog");
    });

    it("should throw NotFoundException when blog not found", async () => {
      (blogsRepository.findById as Mock).mockResolvedValue(null);

      await expect(blogsService.getById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create", () => {
    const createInput = {
      title: "New Blog",
      content: "Blog content",
      coverImage: "https://example.com/cover.jpg",
      slug: "new-blog",
      active: true,
    };

    it("should create blog successfully", async () => {
      (blogsRepository.create as Mock).mockResolvedValue({
        id: "new-blog-1",
        ...createInput,
        authorId: "user-1",
        author: mockAuthor,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await blogsService.create(createInput, "user-1");

      expect(result.data.id).toBe("new-blog-1");
      expect(result.data.title).toBe("New Blog");
      expect(blogsRepository.create).toHaveBeenCalledWith({
        title: "New Blog",
        content: "Blog content",
        coverImage: "https://example.com/cover.jpg",
        slug: "new-blog",
        active: true,
        author: { connect: { id: "user-1" } },
      });
    });
  });

  describe("update", () => {
    it("should update blog successfully", async () => {
      (blogsRepository.findById as Mock).mockResolvedValue({
        id: "blog-1",
        title: "Old Title",
      });
      (blogsRepository.update as Mock).mockResolvedValue({
        id: "blog-1",
        title: "Updated Title",
        content: "Updated content",
        coverImage: "https://example.com/new.jpg",
        slug: "updated-blog",
        active: true,
        authorId: "user-1",
        author: mockAuthor,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await blogsService.update("blog-1", {
        title: "Updated Title",
      });

      expect(result.data.title).toBe("Updated Title");
    });

    it("should throw NotFoundException when blog not found", async () => {
      (blogsRepository.findById as Mock).mockResolvedValue(null);

      await expect(
        blogsService.update("non-existent", { title: "Test" }),
      ).rejects.toThrow(NotFoundException);
    });

    it.each(UNTRUSTED_BLOG_COVER_URLS)(
      "does not delete the replaced cover from %s",
      async (_source, coverImage) => {
        (blogsRepository.findById as Mock).mockResolvedValue({
          id: "blog-1",
          coverImage,
        });
        (blogsRepository.update as Mock).mockResolvedValue({
          id: "blog-1",
          coverImage: "https://example.com/replacement.jpg",
        });

        await blogsService.update("blog-1", {
          coverImage: "https://example.com/replacement.jpg",
        });

        expect(deleteFile).not.toHaveBeenCalled();
      },
    );

    it("does not automatically delete even a trusted replaced cover", async () => {
      (blogsRepository.findById as Mock).mockResolvedValue({
        id: "blog-1",
        coverImage: BLOG_COVER_URL,
      });
      (blogsRepository.update as Mock).mockResolvedValue({
        id: "blog-1",
        coverImage: "https://example.com/replacement.jpg",
      });

      await blogsService.update("blog-1", {
        coverImage: "https://example.com/replacement.jpg",
      });

      expect(deleteFile).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should delete blog successfully", async () => {
      (blogsRepository.findById as Mock).mockResolvedValue({
        id: "blog-1",
        title: "To Delete",
      });
      (blogsRepository.delete as Mock).mockResolvedValue(undefined);

      const result = await blogsService.remove("blog-1");

      expect(result.data.id).toBe("blog-1");
      expect(blogsRepository.delete).toHaveBeenCalledWith("blog-1");
    });

    it("should throw NotFoundException when blog not found", async () => {
      (blogsRepository.findById as Mock).mockResolvedValue(null);

      await expect(blogsService.remove("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each(UNTRUSTED_BLOG_COVER_URLS)(
      "does not delete the stored cover from %s",
      async (_source, coverImage) => {
        (blogsRepository.findById as Mock).mockResolvedValue({
          id: "blog-1",
          coverImage,
        });

        await blogsService.remove("blog-1");

        expect(deleteFile).not.toHaveBeenCalled();
        expect(blogsRepository.delete).toHaveBeenCalledWith("blog-1");
      },
    );

    it("removes the record without automatically deleting its stored cover", async () => {
      (blogsRepository.findById as Mock).mockResolvedValue({
        id: "blog-1",
        coverImage: BLOG_COVER_URL,
      });

      await blogsService.remove("blog-1");

      expect(deleteFile).not.toHaveBeenCalled();
      expect(blogsRepository.delete).toHaveBeenCalledWith("blog-1");
    });
  });
});
