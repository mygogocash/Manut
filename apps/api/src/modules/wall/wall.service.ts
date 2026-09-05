import type { Prisma } from "@nexora/database";

import {
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { wallRepository } from "@/modules/wall/wall.repository";
import type {
  AddCommentInput,
  CreatePostInput,
  ReactInput,
  UpdatePostInput,
} from "@/modules/wall/wall.validation";

export const wallService = {
  async listPosts(page: number, limit: number) {
    const { data, total } = await wallRepository.findAll(page, limit);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getPostById(id: string) {
    const post = await wallRepository.findById(id);
    if (!post) throw new NotFoundException("Post not found");
    return post;
  },

  async createPost(authorId: string, input: CreatePostInput) {
    return wallRepository.create({
      authorId,
      content: input.content,
      type: input.type ?? "post",
      attachments:
        input.attachments && input.attachments.length > 0
          ? (input.attachments as unknown as Prisma.InputJsonValue)
          : undefined,
    });
  },

  async updatePost(postId: string, userId: string, input: UpdatePostInput) {
    const post = await wallRepository.findById(postId);
    if (!post) throw new NotFoundException("Post not found");
    if (post.authorId !== userId) {
      throw new ForbiddenException("You can only update your own posts");
    }
    return wallRepository.update(postId, { content: input.content });
  },

  async react(postId: string, userId: string, input: ReactInput) {
    const post = await wallRepository.findById(postId);
    if (!post) throw new NotFoundException("Post not found");

    const reactions = (post.reactions as Record<string, string[]> | null) ?? {};
    const reactionType = input.reaction;

    if (!reactions[reactionType]) reactions[reactionType] = [];

    const reactionList = reactions[reactionType]!;
    const idx = reactionList.indexOf(userId);
    if (idx >= 0) {
      reactionList.splice(idx, 1);
    } else {
      for (const key of Object.keys(reactions)) {
        const list = reactions[key];
        if (list) {
          reactions[key] = list.filter((uid: string) => uid !== userId);
        }
      }
      reactionList.push(userId);
    }

    return wallRepository.updateReactions(postId, reactions);
  },

  async addComment(postId: string, authorId: string, input: AddCommentInput) {
    const post = await wallRepository.findById(postId);
    if (!post) throw new NotFoundException("Post not found");
    return wallRepository.addComment({
      postId,
      authorId,
      content: input.content,
    });
  },

  async deletePost(postId: string) {
    const post = await wallRepository.findById(postId);
    if (!post) throw new NotFoundException("Post not found");
    return wallRepository.delete(postId);
  },
};
