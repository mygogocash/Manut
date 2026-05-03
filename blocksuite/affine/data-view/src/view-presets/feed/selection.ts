import { z } from 'zod';

export const FeedViewTypeSchema = z.object({
  viewId: z.string(),
  type: z.literal('feed'),
});

export const FeedRowSelectionSchema = z.object({
  selectionType: z.literal('row'),
  rowId: z.string(),
});

export const FeedViewSelectionSchema = FeedRowSelectionSchema;

export const FeedViewSelectionWithTypeSchema = z.intersection(
  FeedViewTypeSchema,
  FeedRowSelectionSchema
);

export type FeedRowSelection = z.TypeOf<typeof FeedRowSelectionSchema>;
export type FeedViewSelection = z.TypeOf<typeof FeedViewSelectionSchema>;
export type FeedViewSelectionWithType = z.TypeOf<
  typeof FeedViewSelectionWithTypeSchema
>;
