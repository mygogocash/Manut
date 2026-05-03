import { z } from 'zod';

export const TimelineViewTypeSchema = z.object({
  viewId: z.string(),
  type: z.literal('timeline'),
});

export const TimelineRowSelectionSchema = z.object({
  selectionType: z.literal('row'),
  rowId: z.string(),
});

export const TimelineViewSelectionSchema = TimelineRowSelectionSchema;

export const TimelineViewSelectionWithTypeSchema = z.intersection(
  TimelineViewTypeSchema,
  TimelineRowSelectionSchema
);

export type TimelineRowSelection = z.TypeOf<typeof TimelineRowSelectionSchema>;
export type TimelineViewSelection = z.TypeOf<typeof TimelineViewSelectionSchema>;
export type TimelineViewSelectionWithType = z.TypeOf<
  typeof TimelineViewSelectionWithTypeSchema
>;
