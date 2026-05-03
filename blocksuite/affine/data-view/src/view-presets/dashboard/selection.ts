import { z } from 'zod';

export const DashboardViewTypeSchema = z.object({
  viewId: z.string(),
  type: z.literal('dashboard'),
});

export const DashboardCellSelectionSchema = z.object({
  selectionType: z.literal('cell'),
  cellId: z.string(),
});

export const DashboardViewSelectionSchema = DashboardCellSelectionSchema;

export const DashboardViewSelectionWithTypeSchema = z.intersection(
  DashboardViewTypeSchema,
  DashboardCellSelectionSchema
);

export type DashboardCellSelection = z.TypeOf<typeof DashboardCellSelectionSchema>;
export type DashboardViewSelection = z.TypeOf<typeof DashboardViewSelectionSchema>;
export type DashboardViewSelectionWithType = z.TypeOf<
  typeof DashboardViewSelectionWithTypeSchema
>;
