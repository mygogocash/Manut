import { z } from "zod";

export const createArticleSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(500),
  link: z.string().url("Link must be a valid URL"),
  date: z.string().min(1, "Date is required"),
  img: z.string().url("Image must be a valid URL"),
});

export const updateArticleSchema = createArticleSchema.partial();

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
