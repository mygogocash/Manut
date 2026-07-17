import type { Prisma } from "@manut/database";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { newsRepository } from "@/modules/news/news.repository";
import type {
  CreateNewsInput,
  UpdateNewsInput,
} from "@/modules/news/news.validation";

export const newsService = {
  async listNews(page: number, limit: number) {
    const { data, total } = await newsRepository.findAll(page, limit);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getNewsById(id: string) {
    const news = await newsRepository.findById(id);
    if (!news) throw new NotFoundException("News not found");
    return news;
  },

  async createNews(authorId: string, input: CreateNewsInput) {
    return newsRepository.create({
      title: input.title,
      content: input.content,
      category: input.category,
      isPinned: input.isPinned,
      authorId,
      attachments:
        input.attachments && input.attachments.length > 0
          ? (input.attachments as unknown as Prisma.InputJsonValue)
          : undefined,
    });
  },

  async updateNews(id: string, input: UpdateNewsInput) {
    const news = await newsRepository.findById(id);
    if (!news) throw new NotFoundException("News not found");
    return newsRepository.update(id, input);
  },

  async deleteNews(id: string) {
    const news = await newsRepository.findById(id);
    if (!news) throw new NotFoundException("News not found");
    return newsRepository.delete(id);
  },
};
