import { z } from 'zod';

export const ListViewTypeSchema = z.object({
  viewId: z.string(),
  type: z.literal('list'),
});

export const ListRowSelectionSchema = z.object({
  selectionType: z.literal('row'),
  rowId: z.string(),
});

export const ListViewSelectionSchema = ListRowSelectionSchema;

export const ListViewSelectionWithTypeSchema = z.intersection(
  ListViewTypeSchema,
  ListRowSelectionSchema
);

export type ListRowSelection = z.TypeOf<typeof ListRowSelectionSchema>;
export type ListViewSelection = z.TypeOf<typeof ListViewSelectionSchema>;
export type ListViewSelectionWithType = z.TypeOf<
  typeof ListViewSelectionWithTypeSchema
>;
