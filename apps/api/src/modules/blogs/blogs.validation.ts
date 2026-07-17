import { z } from "zod";

export const createBlogSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(250),
  content: z.string().min(2, "Content must be at least 2 characters"),
  coverImage: z.string().url("Cover image must be a valid URL"),
  slug: z.string().max(250).optional(),
  active: z.boolean().default(true),
});

export const updateBlogSchema = z.object({
  title: z.string().min(2).max(250).optional(),
  content: z.string().min(2).optional(),
  coverImage: z.string().url().optional(),
  slug: z.string().max(250).nullable().optional(),
  active: z.boolean().optional(),
});

export type CreateBlogInput = z.infer<typeof createBlogSchema>;
export type UpdateBlogInput = z.infer<typeof updateBlogSchema>;
