import { z } from 'zod';

export const MapViewTypeSchema = z.object({
  viewId: z.string(),
  type: z.literal('map'),
});

export const MapPinSelectionSchema = z.object({
  selectionType: z.literal('pin'),
  rowId: z.string(),
});

export const MapViewSelectionSchema = MapPinSelectionSchema;

export const MapViewSelectionWithTypeSchema = z.intersection(
  MapViewTypeSchema,
  MapPinSelectionSchema
);

export type MapPinSelection = z.TypeOf<typeof MapPinSelectionSchema>;
export type MapViewSelection = z.TypeOf<typeof MapViewSelectionSchema>;
export type MapViewSelectionWithType = z.TypeOf<
  typeof MapViewSelectionWithTypeSchema
>;
