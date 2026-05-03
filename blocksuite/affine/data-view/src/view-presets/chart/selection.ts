import { z } from 'zod';

export const ChartViewTypeSchema = z.object({
  viewId: z.string(),
  type: z.literal('chart'),
});

export const ChartBarSelectionSchema = z.object({
  selectionType: z.literal('bar'),
  xValue: z.string(),
});

export const ChartViewSelectionSchema = ChartBarSelectionSchema;

export const ChartViewSelectionWithTypeSchema = z.intersection(
  ChartViewTypeSchema,
  ChartBarSelectionSchema
);

export type ChartBarSelection = z.TypeOf<typeof ChartBarSelectionSchema>;
export type ChartViewSelection = z.TypeOf<typeof ChartViewSelectionSchema>;
export type ChartViewSelectionWithType = z.TypeOf<
  typeof ChartViewSelectionWithTypeSchema
>;
