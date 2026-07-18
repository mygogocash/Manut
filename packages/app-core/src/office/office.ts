import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const officeSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    city: z.string().min(1).optional(),
  })
  .passthrough();

// List receipts omit street address. Manage CRUD stays deferred.
const officeApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    address: nullableText.optional(),
    city: z.string().min(1),
    country: z.string().min(1),
    timezone: nullableText.optional(),
    capacity: z.number().int().nonnegative(),
    isActive: z.boolean(),
  })
  .passthrough();

export const officeSchema = officeApiSchema.transform((office) => ({
  id: office.id,
  name: office.name,
  city: office.city,
  country: office.country,
  capacity: office.capacity,
  isActive: office.isActive,
}));

const officesResponseSchema = z
  .object({
    data: z.array(officeSchema),
  })
  .strict();

// Room list strips booking slot grids and raw image URLs.
const officeRoomApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    capacity: z.number().int().nonnegative(),
    amenities: z.array(z.string()).default([]),
    imageUrl: nullableText.optional(),
    office: officeSummarySchema,
    timeSlots: z.unknown().optional(),
  })
  .passthrough();

export const officeRoomSchema = officeRoomApiSchema.transform((room) => ({
  id: room.id,
  name: room.name,
  capacity: room.capacity,
  amenities: room.amenities,
  hasImage: Boolean(room.imageUrl),
  office: {
    id: room.office.id,
    name: room.office.name,
    city: room.office.city ?? "",
  },
}));

const officeRoomsResponseSchema = z
  .object({
    data: z.array(officeRoomSchema),
  })
  .strict();

// Asset list strips purchase/book/sale amounts, notes, and assignee email.
const officeAssetApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1),
    serialNo: nullableText.optional(),
    status: z.string().min(1),
    manufacturer: nullableText.optional(),
    model: nullableText.optional(),
    purchaseCost: z.unknown().optional(),
    bookValue: z.unknown().optional(),
    sellingPrice: z.unknown().optional(),
    notes: z.unknown().optional(),
    office: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    }),
    assignee: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        email: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const officeAssetSchema = officeAssetApiSchema.transform((asset) => ({
  id: asset.id,
  name: asset.name,
  type: asset.type,
  serialNo: asset.serialNo ?? null,
  status: asset.status,
  manufacturer: asset.manufacturer ?? null,
  model: asset.model ?? null,
  office: { id: asset.office.id, name: asset.office.name },
  assignee: asset.assignee
    ? { id: asset.assignee.id, name: asset.assignee.name }
    : null,
}));

const officeAssetsResponseSchema = z
  .object({
    data: z.array(officeAssetSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const officeAssetListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    officeId: z.string().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type Office = z.infer<typeof officeSchema>;
export type OfficeRoom = z.infer<typeof officeRoomSchema>;
export type OfficeAsset = z.infer<typeof officeAssetSchema>;
export type OfficeAssetListParams = z.input<typeof officeAssetListParamsSchema>;
export type OfficeList = z.infer<typeof officesResponseSchema>;
export type OfficeRoomList = z.infer<typeof officeRoomsResponseSchema>;
export type OfficeAssetList = z.infer<typeof officeAssetsResponseSchema>;

export const OFFICES_QUERY_ROOT = ["office", "offices"] as const;
export const OFFICE_ROOMS_QUERY_ROOT = ["office", "rooms"] as const;
export const OFFICE_ASSETS_QUERY_ROOT = ["office", "assets"] as const;

export function officesQueryKey() {
  return [...OFFICES_QUERY_ROOT] as const;
}

export function officeRoomsQueryKey() {
  return [...OFFICE_ROOMS_QUERY_ROOT] as const;
}

export function officeAssetsQueryKey(params: OfficeAssetListParams = {}) {
  return [
    ...OFFICE_ASSETS_QUERY_ROOT,
    officeAssetListParamsSchema.parse(params),
  ] as const;
}

function encodeAssetQuery(
  params: z.output<typeof officeAssetListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["officeId", params.officeId],
    ["type", params.type],
    ["status", params.status],
    ["search", params.search],
  ];
  return entries
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

export async function listOffices(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<OfficeList> {
  const response = await client.get<unknown>(
    "/office/offices",
    signal ? { signal } : undefined,
  );
  return officesResponseSchema.parse(response);
}

export async function listOfficeRooms(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<OfficeRoomList> {
  const response = await client.get<unknown>(
    "/office/rooms",
    signal ? { signal } : undefined,
  );
  return officeRoomsResponseSchema.parse(response);
}

export async function listOfficeAssets(
  client: ApiClient,
  params: OfficeAssetListParams = {},
  signal?: RequestAbortSignal,
): Promise<OfficeAssetList> {
  const query = encodeAssetQuery(officeAssetListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/office/assets?${query}`,
    signal ? { signal } : undefined,
  );
  return officeAssetsResponseSchema.parse(response);
}
