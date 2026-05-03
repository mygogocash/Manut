import { z } from 'zod';

export const GalleryViewTypeSchema = z.object({
  viewId: z.string(),
  type: z.literal('gallery'),
});

export const GalleryRowSelectionSchema = z.object({
  selectionType: z.literal('row'),
  rowId: z.string(),
});

export const GalleryMultiSelectionSchema = z.object({
  selectionType: z.literal('multi'),
  rowIds: z.array(z.string()),
});

export const GalleryViewSelectionSchema = z.union([
  GalleryRowSelectionSchema,
  GalleryMultiSelectionSchema,
]);

export const GalleryViewSelectionWithTypeSchema = z.union([
  z.intersection(GalleryViewTypeSchema, GalleryRowSelectionSchema),
  z.intersection(GalleryViewTypeSchema, GalleryMultiSelectionSchema),
]);

export type GalleryRowSelection = z.TypeOf<typeof GalleryRowSelectionSchema>;
export type GalleryMultiSelection = z.TypeOf<
  typeof GalleryMultiSelectionSchema
>;
export type GalleryViewSelection = z.TypeOf<typeof GalleryViewSelectionSchema>;
export type GalleryViewSelectionWithType = z.TypeOf<
  typeof GalleryViewSelectionWithTypeSchema
>;
