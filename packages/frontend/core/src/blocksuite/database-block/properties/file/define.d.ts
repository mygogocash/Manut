import zod from 'zod';
export declare const fileColumnType: {
    type: "attachment";
    modelConfig: <PropertyData extends Record<string, unknown> = Record<string, never>, RawValue = unknown, JsonValue = unknown>(ops: import("@blocksuite/data-view").PropertyConfig<PropertyData, RawValue, JsonValue>) => import("@blocksuite/data-view").PropertyModel<"attachment", PropertyData, RawValue, JsonValue>;
};
export declare const FileItemSchema: zod.ZodObject<{
    id: zod.ZodString;
    name: zod.ZodString;
    mime: zod.ZodOptional<zod.ZodString>;
    order: zod.ZodString;
}, "strip", zod.ZodTypeAny, {
    id: string;
    order: string;
    name: string;
    mime?: string | undefined;
}, {
    id: string;
    order: string;
    name: string;
    mime?: string | undefined;
}>;
export type FileItemType = zod.TypeOf<typeof FileItemSchema>;
declare const FileCellRawValueTypeSchema: zod.ZodRecord<zod.ZodString, zod.ZodObject<{
    id: zod.ZodString;
    name: zod.ZodString;
    mime: zod.ZodOptional<zod.ZodString>;
    order: zod.ZodString;
}, "strip", zod.ZodTypeAny, {
    id: string;
    order: string;
    name: string;
    mime?: string | undefined;
}, {
    id: string;
    order: string;
    name: string;
    mime?: string | undefined;
}>>;
export declare const FileCellJsonValueTypeSchema: zod.ZodArray<zod.ZodString, "many">;
export type FileCellRawValueType = zod.TypeOf<typeof FileCellRawValueTypeSchema>;
export type FileCellJsonValueType = zod.TypeOf<typeof FileCellJsonValueTypeSchema>;
export declare const filePropertyModelConfig: import("@blocksuite/data-view").PropertyModel<"attachment", {}, Record<string, {
    id: string;
    order: string;
    name: string;
    mime?: string | undefined;
}>, string[]>;
export {};
//# sourceMappingURL=define.d.ts.map