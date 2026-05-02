import { z } from 'zod';

export const CalendarViewTypeSchema = z.object({
  viewId: z.string(),
  type: z.literal('calendar'),
});

export const CalendarDayCellSelectionSchema = z.object({
  selectionType: z.literal('day-cell'),
  date: z.string(),
});

export const CalendarRowSelectionSchema = z.object({
  selectionType: z.literal('row'),
  rowId: z.string(),
});

export const CalendarViewSelectionSchema = z.union([
  CalendarDayCellSelectionSchema,
  CalendarRowSelectionSchema,
]);

export const CalendarViewSelectionWithTypeSchema = z.union([
  z.intersection(CalendarViewTypeSchema, CalendarDayCellSelectionSchema),
  z.intersection(CalendarViewTypeSchema, CalendarRowSelectionSchema),
]);

export type CalendarDayCellSelection = z.TypeOf<
  typeof CalendarDayCellSelectionSchema
>;
export type CalendarRowSelection = z.TypeOf<typeof CalendarRowSelectionSchema>;
export type CalendarViewSelection = z.TypeOf<typeof CalendarViewSelectionSchema>;
export type CalendarViewSelectionWithType = z.TypeOf<
  typeof CalendarViewSelectionWithTypeSchema
>;
