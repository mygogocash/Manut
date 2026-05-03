import { z } from 'zod';

export const FormViewTypeSchema = z.object({
  viewId: z.string(),
  type: z.literal('form'),
});

export const FormFieldSelectionSchema = z.object({
  selectionType: z.literal('field'),
  fieldId: z.string(),
});

export const FormViewSelectionSchema = FormFieldSelectionSchema;

export const FormViewSelectionWithTypeSchema = z.intersection(
  FormViewTypeSchema,
  FormFieldSelectionSchema
);

export type FormFieldSelection = z.TypeOf<typeof FormFieldSelectionSchema>;
export type FormViewSelection = z.TypeOf<typeof FormViewSelectionSchema>;
export type FormViewSelectionWithType = z.TypeOf<
  typeof FormViewSelectionWithTypeSchema
>;
