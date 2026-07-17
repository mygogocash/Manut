import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface Desk {
  id: string;
  label: string;
  floor: string | null;
  zone: string | null;
  isAvailable: boolean;
  bookedBy: { id: string; name: string; email: string } | null;
  bookingId: string | null;
}

export interface DeskBooking {
  id: string;
  deskId: string;
  date: string;
  desk: Pick<Desk, "id" | "label" | "floor" | "zone">;
  employee: { id: string; name: string; email: string };
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: string | null;
  amenities: string[];
  imageUrl: string | null;
  // Width of one grid slot in minutes (30 today; switch to 15 server-
  // side and the UI scales without changes).
  slotMinutes: number;
  // Maximum consecutive slots a single user may pick in one booking.
  maxConsecutiveSlots: number;
  timeSlots: RoomTimeSlot[];
}

export interface RoomTimeSlot {
  time: string;
  endTime: string;
  isAvailable: boolean;
  bookedBy: { id: string; name: string } | null;
  bookingId: string | null;
  title: string | null;
  description: string | null;
  attendeesCount: number | null;
  bookingStart: string | null;
  bookingEnd: string | null;
}

export interface RoomBooking {
  id: string;
  roomId: string;
  date: string;
  timeSlot: string;
  room: Pick<Room, "id" | "name" | "floor">;
  employee: { id: string; name: string; email: string };
}

// Shape mirrors the API repository response (Prisma row + included
// office/assignee). Aligned in the role-icons / asset-form fix PR — the
// Phase 1 client used `category` / `serialNumber` / `office: string` /
// `assignedTo` aliases that didn't match the server contract, so create
// requests bounced with "Validation failed".
export interface AssetOfficeRef {
  id: string;
  name: string;
}

export interface AssetAssignee {
  id: string;
  name: string;
  email: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  serialNo: string | null;
  officeId: string;
  assigneeId: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  status: string;
  notes: string | null;
  // Hardware metadata.
  manufacturer: string | null;
  model: string | null;
  colour: string | null;
  subType: string | null;
  operatingSystem: string | null;
  description: string | null;
  supportLink: string | null;
  activeServiceDate: string | null;
  department: string | null;
  assetCode: string | null;
  // Software.
  version: string | null;
  // Accounting.
  quantity: number;
  usefulLifeMonths: number | null;
  bookValue: number | null;
  disposalDate: string | null;
  sellingPrice: number | null;
  office: AssetOfficeRef | null;
  assignee: AssetAssignee | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetInput {
  // officeId is required server-side. Form must surface a real picker
  // backed by listOffices(); free-text labels are no longer accepted.
  officeId: string;
  name: string;
  type: string;
  serialNo?: string;
  assignedTo?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  status?: string;
  notes?: string;

  manufacturer?: string;
  model?: string;
  colour?: string;
  subType?: string;
  operatingSystem?: string;
  description?: string;
  supportLink?: string;
  activeServiceDate?: string;
  department?: string;
  assetCode?: string;
  version?: string;
  quantity?: number;
  usefulLifeMonths?: number;
  bookValue?: number;
  disposalDate?: string;
  sellingPrice?: number;
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

export interface AssetParams {
  page?: number;
  limit?: number;
  officeId?: string;
  type?: string;
  status?: string;
  search?: string;
}

export const ASSET_STATUSES = [
  "available",
  "in_use",
  "active",
  "owner",
  "ordered",
  "maintenance",
  "retired",
  "disposed",
] as const;

export const ASSET_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  in_use: "In Use",
  active: "Active",
  owner: "Owner",
  ordered: "Ordered",
  maintenance: "In Repair",
  retired: "Retired",
  disposed: "Disposed",
};

export const ASSET_CATEGORIES = [
  "laptop",
  "mobile",
  "monitor",
  "peripheral",
  "usb_accessory",
  "software",
  "furniture",
  "other",
] as const;

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  laptop: "Laptop",
  mobile: "Mobile",
  monitor: "Monitor",
  peripheral: "Peripheral",
  usb_accessory: "USB / Accessory",
  software: "Software",
  furniture: "Furniture",
  other: "Other",
};

// ─── Helpers ────────────────────────────────────────────

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// ─── Office Service ─────────────────────────────────────

export interface Office {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone?: string | null;
  capacity?: number;
  isActive?: boolean;
}

export interface CreateOfficeInput {
  name: string;
  address?: string | null;
  city: string;
  country: string;
  timezone?: string | null;
  capacity?: number;
  isActive?: boolean;
}

export type UpdateOfficeInput = Partial<CreateOfficeInput>;

export async function listOffices(): Promise<ApiSuccessResponse<Office[]>> {
  return api.get("/office/offices");
}

export async function createOffice(
  input: CreateOfficeInput,
): Promise<ApiSuccessResponse<Office>> {
  return api.post("/office/offices", input);
}

export async function updateOffice(
  id: string,
  input: UpdateOfficeInput,
): Promise<ApiSuccessResponse<Office>> {
  return api.put(`/office/offices/${id}`, input);
}

export async function deleteOffice(id: string): Promise<void> {
  await api.delete(`/office/offices/${id}`);
}

// ─── Desk Service ───────────────────────────────────────

export interface AdminDesk {
  id: string;
  name: string;
  floor: string | null;
  zone: string | null;
  isActive: boolean;
  officeId: string;
  office: { id: string; name: string; city: string | null } | null;
}

export interface CreateDeskInput {
  officeId: string;
  name: string;
  floor?: string | null;
  zone?: string | null;
  isActive?: boolean;
}

export type UpdateDeskInput = Partial<CreateDeskInput>;

export async function listDesks(
  date: string,
): Promise<ApiSuccessResponse<Desk[]>> {
  return api.get(`/office/desks?date=${date}`);
}

export async function listDesksAdmin(
  officeId?: string,
): Promise<ApiSuccessResponse<AdminDesk[]>> {
  const qs = officeId ? `?officeId=${encodeURIComponent(officeId)}` : "";
  return api.get(`/office/desks/manage${qs}`);
}

export async function createDesk(
  input: CreateDeskInput,
): Promise<ApiSuccessResponse<AdminDesk>> {
  return api.post("/office/desks", input);
}

export async function updateDesk(
  id: string,
  input: UpdateDeskInput,
): Promise<ApiSuccessResponse<AdminDesk>> {
  return api.put(`/office/desks/${id}`, input);
}

export async function deleteDesk(id: string): Promise<void> {
  await api.delete(`/office/desks/${id}`);
}

export async function bookDesk(
  deskId: string,
  date: string,
): Promise<ApiSuccessResponse<DeskBooking>> {
  return api.post("/office/desks/book", { deskId, date });
}

// ─── Room Service ───────────────────────────────────────

export interface AdminRoom {
  id: string;
  name: string;
  capacity: number;
  amenities: string[];
  imageUrl: string | null;
  isActive: boolean;
  officeId: string;
  office: { id: string; name: string; city: string | null } | null;
}

export interface CreateRoomInput {
  officeId: string;
  name: string;
  capacity?: number;
  amenities?: string[];
  imageUrl?: string | null;
  isActive?: boolean;
}

export type UpdateRoomInput = Partial<CreateRoomInput>;

export async function listRooms(
  date: string,
): Promise<ApiSuccessResponse<Room[]>> {
  return api.get(`/office/rooms?date=${date}`);
}

export async function listRoomsAdmin(
  officeId?: string,
): Promise<ApiSuccessResponse<AdminRoom[]>> {
  const qs = officeId ? `?officeId=${encodeURIComponent(officeId)}` : "";
  return api.get(`/office/rooms/manage${qs}`);
}

export async function createRoom(
  input: CreateRoomInput,
): Promise<ApiSuccessResponse<AdminRoom>> {
  return api.post("/office/rooms", input);
}

export async function updateRoom(
  id: string,
  input: UpdateRoomInput,
): Promise<ApiSuccessResponse<AdminRoom>> {
  return api.put(`/office/rooms/${id}`, input);
}

export async function deleteRoom(id: string): Promise<void> {
  await api.delete(`/office/rooms/${id}`);
}

export async function bookRoom(
  roomId: string,
  date: string,
  timeSlot: string,
  extras?: {
    endTime?: string;
    endDate?: string;
    title?: string;
    description?: string;
    attendeesCount?: number;
  },
): Promise<ApiSuccessResponse<RoomBooking>> {
  return api.post("/office/rooms/book", {
    roomId,
    date,
    timeSlot,
    ...(extras?.endTime && { endTime: extras.endTime }),
    ...(extras?.endDate && { endDate: extras.endDate }),
    ...(extras?.title && { title: extras.title }),
    ...(extras?.description && { description: extras.description }),
    ...(extras?.attendeesCount && { attendeesCount: extras.attendeesCount }),
  });
}

export interface SearchedRoomConflict {
  bookingId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string | null;
  seriesId: string | null;
  bookedBy: { id: string; name: string };
}

export interface SearchedRoom {
  id: string;
  name: string;
  capacity: number;
  floor: string | null;
  amenities: string[];
  imageUrl: string | null;
  officeId: string;
  office: { id: string; name: string; city: string } | null;
  status: "available" | "occupied";
  /**
   * Existing bookings that overlap the search window. Empty when the
   * room is `available`. Multi-day series are collapsed to a single
   * entry (earliest day) — the UI surfaces enough to identify who
   * holds the slot without flooding the card.
   */
  conflicts: SearchedRoomConflict[];
}

export async function searchRooms(params: {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  officeId?: string;
  status?: "available" | "occupied" | "all";
}): Promise<ApiSuccessResponse<SearchedRoom[]>> {
  const qs = new URLSearchParams();
  qs.set("startDate", params.startDate);
  qs.set("endDate", params.endDate);
  qs.set("startTime", params.startTime);
  qs.set("endTime", params.endTime);
  if (params.officeId) qs.set("officeId", params.officeId);
  if (params.status) qs.set("status", params.status);
  return api.get(`/office/rooms/search?${qs.toString()}`);
}

// ─── Asset Service ──────────────────────────────────────

export async function listAssets(
  params: AssetParams = {},
): Promise<ApiPaginatedResponse<Asset>> {
  return api.get(`/office/assets${buildQuery(params)}`);
}

export async function createAsset(
  input: CreateAssetInput,
): Promise<ApiSuccessResponse<Asset>> {
  return api.post("/office/assets", input);
}

export async function updateAsset(
  id: string,
  input: UpdateAssetInput,
): Promise<ApiSuccessResponse<Asset>> {
  return api.put(`/office/assets/${id}`, input);
}

export async function getAssetById(
  id: string,
): Promise<ApiSuccessResponse<Asset>> {
  return api.get(`/office/assets/${id}`);
}

export async function deleteAsset(id: string): Promise<void> {
  await api.delete(`/office/assets/${id}`);
}

// ─── Asset bulk import ──────────────────────────────────

export interface AssetImportRow {
  type: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  colour?: string | null;
  subType?: string | null;
  serialNo?: string | null;
  operatingSystem?: string | null;
  status?: string | null;
  description?: string | null;
  supportLink?: string | null;
  activeServiceDate?: string | null;
  department?: string | null;
  version?: string | null;
  notes?: string | null;
  assigneeEmail?: string | null;
  assigneeFirstName?: string | null;
  assigneeLastName?: string | null;
  sourceSheet?: string | null;
}

export interface AssetImportPreviewRow {
  row: number;
  sourceSheet: string | null;
  type: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  colour: string | null;
  subType: string | null;
  serialNo: string | null;
  operatingSystem: string | null;
  status: string;
  description: string | null;
  supportLink: string | null;
  activeServiceDate: string | null;
  department: string | null;
  version: string | null;
  notes: string | null;
  assigneeRaw: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  officeId: string | null;
  officeName: string | null;
  action: "insert" | "update";
  matchedAssetId: string | null;
  errors: string[];
  warnings: string[];
}

export interface AssetImportPreview {
  rows: AssetImportPreviewRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    inserts: number;
    updates: number;
    unresolvedAssignees: number;
  };
}

export interface AssetImportCommitResult {
  inserts: number;
  updates: number;
  skipped: number;
  errors: Array<{ row: number; errors: string[] }>;
}

export async function previewAssetImport(
  rows: AssetImportRow[],
): Promise<ApiSuccessResponse<AssetImportPreview>> {
  return api.post("/office/assets/import/preview", { rows });
}

export async function commitAssetImport(
  rows: AssetImportRow[],
): Promise<ApiSuccessResponse<AssetImportCommitResult>> {
  return api.post("/office/assets/import/commit", { rows });
}

export async function cancelDeskBooking(bookingId: string): Promise<void> {
  await api.delete(`/office/desks/bookings/${bookingId}`);
}

export async function cancelRoomBooking(bookingId: string): Promise<void> {
  await api.delete(`/office/rooms/bookings/${bookingId}`);
}

export interface MyRoomBooking {
  id: string;
  roomId: string;
  date: string;
  timeSlot: string;
  endTime: string | null;
  title: string | null;
  description: string | null;
  attendeesCount: number | null;
  room: {
    id: string;
    name: string;
    floor: string | null;
    office: { id: string; name: string; city: string | null } | null;
  };
}

export async function listMyRoomBookings(): Promise<
  ApiSuccessResponse<MyRoomBooking[]>
> {
  return api.get("/office/rooms/my-bookings");
}
