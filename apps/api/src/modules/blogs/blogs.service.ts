import { NotFoundException } from "@/common/exceptions/http-exception";
import { rowsToCsv } from "@/common/utils/csv";
import {
  deleteFile,
  parseStorageUrl,
} from "@/infrastructure/storage/supabase-storage";
import { blogsRepository } from "@/modules/blogs/blogs.repository";
import type {
  CreateBlogInput,
  UpdateBlogInput,
} from "@/modules/blogs/blogs.validation";

export class BlogsService {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = params ?? {};
    const [blogs, total] = await blogsRepository.findAll({
      search,
      page,
      limit,
    });

    return {
      data: blogs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const blog = await blogsRepository.findById(id);
    if (!blog) throw new NotFoundException("Blog not found");
    return { data: blog };
  }

  async create(input: CreateBlogInput, authorId: string) {
    const blog = await blogsRepository.create({
      title: input.title,
      content: input.content,
      coverImage: input.coverImage,
      slug: input.slug,
      active: input.active,
      author: { connect: { id: authorId } },
    });

    return { data: blog };
  }

  async update(id: string, input: UpdateBlogInput) {
    const existing = await blogsRepository.findById(id);
    if (!existing) throw new NotFoundException("Blog not found");

    if (input.coverImage && input.coverImage !== existing.coverImage) {
      const parsed = parseStorageUrl(existing.coverImage);
      if (parsed) {
        await deleteFile(parsed.bucket, parsed.path);
      }
    }

    const updated = await blogsRepository.update(id, input);
    return { data: updated };
  }

  async remove(id: string) {
    const existing = await blogsRepository.findById(id);
    if (!existing) throw new NotFoundException("Blog not found");

    const parsed = parseStorageUrl(existing.coverImage);
    if (parsed) {
      await deleteFile(parsed.bucket, parsed.path);
    }

    await blogsRepository.delete(id);
    return { data: { id } };
  }

  async exportCsv(params?: { search?: string }) {
    const rows = await blogsRepository.findAllForExport(params?.search);
    const headers = [
      "id",
      "title",
      "content",
      "coverImage",
      "slug",
      "active",
      "author",
      "authorId",
      "createdAt",
      "updatedAt",
    ];
    const data = rows.map((b) => [
      b.id,
      b.title,
      b.content,
      b.coverImage,
      b.slug ?? "",
      b.active,
      b.author.name,
      b.authorId,
      b.createdAt.toISOString(),
      b.updatedAt.toISOString(),
    ]);
    return rowsToCsv(headers, data);
  }
}

export const blogsService = new BlogsService();
