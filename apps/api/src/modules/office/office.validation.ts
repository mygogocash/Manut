import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const deskQuerySchema = z.object({
  officeId: z.string().optional(),
  date: dateString.optional(),
  floor: z.string().optional(),
});

export const bookDeskSchema = z.object({
  deskId: z.string().uuid("Invalid desk ID"),
  date: dateString,
});

export const roomQuerySchema = z.object({
  officeId: z.string().optional(),
  date: dateString.optional(),
});

// "HH:MM" 24-hour clock, any minute. Operators asked for free-form
// time entry (e.g. 13:05) rather than the old 15-minute grid.
const hhmm = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

export const bookRoomSchema = z
  .object({
    roomId: z.string().uuid("Invalid room ID"),
    date: dateString,
    // Optional second date for multi-day bookings. When set, the
    // service creates one row per day in the inclusive range
    // [date, endDate] sharing a `seriesId`. Single-day callers omit it.
    endDate: dateString.optional(),
    timeSlot: hhmm,
    // Required for variable-duration bookings. Older clients can send
    // just `timeSlot` and the server will fall back to a one-hour slot.
    endTime: hhmm.optional(),
    title: z.string().max(300).optional(),
    description: z.string().max(2000).optional(),
    attendeesCount: z.coerce.number().int().positive().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.endTime && val.endTime <= val.timeSlot) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be after start time",
      });
    }
    if (val.endDate && val.endDate < val.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date",
      });
    }
  });

// Search rooms by a time window across one or more days. Returns
// every active room with a flag indicating whether it's free for the
// entire window. Powers the new search-driven booking UI.
export const searchRoomsSchema = z
  .object({
    startDate: dateString,
    endDate: dateString,
    startTime: hhmm,
    endTime: hhmm,
    officeId: z.string().optional(),
    // available | occupied | all — filter applied after computing per-room status
    status: z.enum(["available", "occupied", "all"]).default("all"),
  })
  .superRefine((val, ctx) => {
    if (val.endTime <= val.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be after start time",
      });
    }
    if (val.endDate < val.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date",
      });
    }
  });

export const assetQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  officeId: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  // Free-text search across name / serialNo / type. Matched
  // case-insensitively in the repository so reps don't have to remember
  // exact casing on serial numbers.
  search: z.string().max(200).optional(),
});

export const createAssetSchema = z.object({
  officeId: z.string().min(1, "Office ID is required"),
  name: z.string().min(1, "Name is required").max(300),
  type: z.string().min(1, "Type is required"),
  serialNo: z.string().max(100).optional(),
  assignedTo: z.string().uuid().optional(),
  purchaseDate: dateString.optional(),
  purchaseCost: z.coerce.number().nonnegative().optional(),
  status: z.string().default("available"),
  notes: z.string().max(5000).optional(),

  // Hardware metadata.
  manufacturer: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  colour: z.string().max(60).optional(),
  subType: z.string().max(120).optional(),
  operatingSystem: z.string().max(60).optional(),
  description: z.string().max(2000).optional(),
  supportLink: z.string().url().max(500).optional().or(z.literal("")),
  activeServiceDate: dateString.optional(),
  department: z.string().max(120).optional(),
  assetCode: z.string().max(120).optional(),
  // Software.
  version: z.string().max(60).optional(),
  // Accounting.
  quantity: z.coerce.number().int().positive().default(1),
  usefulLifeMonths: z.coerce.number().int().nonnegative().optional(),
  bookValue: z.coerce.number().nonnegative().optional(),
  disposalDate: dateString.optional(),
  sellingPrice: z.coerce.number().nonnegative().optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

// Office CRUD — used by HR / facilities to seed the desk + room
// directories. The list endpoint is unchanged; this adds the manage
// surface so empty offices can be filled in from the UI.
export const createOfficeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().max(500).optional().nullable(),
  city: z.string().min(1, "City is required").max(120),
  country: z.string().min(1, "Country is required").max(120),
  timezone: z.string().max(80).optional().nullable(),
  capacity: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().optional(),
});

export const updateOfficeSchema = createOfficeSchema.partial();

export const createDeskSchema = z.object({
  officeId: z.string().min(1, "Office is required"),
  name: z.string().min(1, "Name is required").max(120),
  floor: z.string().max(40).optional().nullable(),
  zone: z.string().max(80).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateDeskSchema = createDeskSchema.partial();

export const createRoomSchema = z.object({
  officeId: z.string().min(1, "Office is required"),
  name: z.string().min(1, "Name is required").max(120),
  capacity: z.coerce.number().int().nonnegative().default(0),
  // Frontend submits an array; we join with comma when persisting so the
  // existing `amenities` text column stays untouched (no migration).
  amenities: z.array(z.string().max(60)).optional(),
  // Public preview URL from the `uploads` bucket. Empty string clears it.
  imageUrl: z.string().url().max(1000).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

// ─── Asset bulk-import ─────────────────────────────────────
//
// Front-end parses the multi-sheet HR template ("IT Asset Management
// Template.xlsx") locally and POSTs an array of these canonical rows.
// The backend resolves the assignee (by email or name) and the office
// (by user.entityId → entity.country → office.country), then writes.
//
// `serialNo`, `assigneeEmail`, etc. are intentionally permissive — HR
// data has whitespace, missing fields and inconsistent casing. The
// import preview / commit handlers treat unresolved assignees as
// non-fatal and surface them as warnings.

export const assetImportRowSchema = z.object({
  type: z.enum([
    "laptop",
    "mobile",
    "monitor",
    "peripheral",
    "usb_accessory",
    "software",
    "furniture",
    "other",
  ]),
  name: z.string().min(1, "Name is required").max(300),
  manufacturer: z.string().max(120).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  colour: z.string().max(60).optional().nullable(),
  subType: z.string().max(120).optional().nullable(),
  serialNo: z.string().max(100).optional().nullable(),
  operatingSystem: z.string().max(60).optional().nullable(),
  status: z.string().max(40).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  supportLink: z.string().max(500).optional().nullable(),
  activeServiceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "activeServiceDate must be YYYY-MM-DD")
    .optional()
    .nullable(),
  department: z.string().max(120).optional().nullable(),
  version: z.string().max(60).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  assigneeEmail: z.string().max(200).optional().nullable(),
  assigneeFirstName: z.string().max(120).optional().nullable(),
  assigneeLastName: z.string().max(120).optional().nullable(),
  // Source sheet name — surfaced in the preview so HR can spot which
  // tab a flagged row came from.
  sourceSheet: z.string().max(40).optional().nullable(),
});

export const assetImportSchema = z.object({
  rows: z.array(assetImportRowSchema).min(1, "rows is required").max(2000),
});

export type AssetImportRow = z.infer<typeof assetImportRowSchema>;
export type AssetImportInput = z.infer<typeof assetImportSchema>;

export type DeskQuery = z.infer<typeof deskQuerySchema>;
export type BookDeskInput = z.infer<typeof bookDeskSchema>;
export type RoomQuery = z.infer<typeof roomQuerySchema>;
export type BookRoomInput = z.infer<typeof bookRoomSchema>;
export type SearchRoomsInput = z.infer<typeof searchRoomsSchema>;
export type AssetQuery = z.infer<typeof assetQuerySchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type CreateOfficeInput = z.infer<typeof createOfficeSchema>;
export type UpdateOfficeInput = z.infer<typeof updateOfficeSchema>;
export type CreateDeskInput = z.infer<typeof createDeskSchema>;
export type UpdateDeskInput = z.infer<typeof updateDeskSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
