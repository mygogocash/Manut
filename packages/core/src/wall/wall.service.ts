import type { Db } from "@nexora/db";
import type {
  AddCommentInput,
  CreatePostInput,
  ReactInput,
  UpdatePostInput,
} from "@nexora/contracts/modules/wall/wall.validation";
import { ForbiddenException, NotFoundException } from "../http-exception";
import * as repo from "./wall.repository";

export async function listPosts(db: Db, page: number, limit: number) {
  const { data, total } = await repo.findAllPosts(db, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getPostById(db: Db, id: string) {
  const post = await repo.findPostById(db, id);
  if (!post) throw new NotFoundException("Post not found");
  return post;
}

export async function createPost(db: Db, authorId: string, input: CreatePostInput) {
  return repo.createPost(db, {
    authorId,
    content: input.content,
    type: input.type ?? "post",
    attachments: input.attachments && input.attachments.length > 0 ? input.attachments : undefined,
  });
}

export async function updatePost(db: Db, postId: string, userId: string, input: UpdatePostInput) {
  const post = await repo.findPostById(db, postId);
  if (!post) throw new NotFoundException("Post not found");
  if (post.authorId !== userId) throw new ForbiddenException("You can only update your own posts");
  return repo.updatePost(db, postId, input.content);
}

export async function react(db: Db, postId: string, userId: string, input: ReactInput) {
  const post = await repo.findPostById(db, postId);
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
      if (list) reactions[key] = list.filter((uid) => uid !== userId);
    }
    reactionList.push(userId);
  }
  return repo.updateReactions(db, postId, reactions);
}

export async function addComment(db: Db, postId: string, authorId: string, input: AddCommentInput) {
  const post = await repo.findPostById(db, postId);
  if (!post) throw new NotFoundException("Post not found");
  return repo.addComment(db, { postId, authorId, content: input.content });
}

export async function deletePost(db: Db, postId: string) {
  const post = await repo.findPostById(db, postId);
  if (!post) throw new NotFoundException("Post not found");
  await repo.deletePost(db, postId);
}
