import { isIsoCurrencyCode } from "@nexora/utils";
import { z } from "zod";

import { isValidOptionalYmdRange } from "@/common/optional-ymd-range";

const currencyCodeSchema = z
  .string()
  .min(1, "Currency is required")
  .transform((v) => v.toUpperCase())
  .refine(isIsoCurrencyCode, {
    message: "Currency must be a valid ISO 4217 code",
  });

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

// Canonical menus surfaced on the request form. Stored as strings (not
// Postgres enums) so HR can extend them without a migration; the UI is
// the source of truth for the labels.
//
// `TRAVEL_CATEGORIES` drives amount-band approval routing. `general`
// keeps a request on the universal chain (every step matches);
// `business_or_bd` triggers the Sarah-vs-Sid amount-band steps.
export const TRAVEL_CATEGORIES = ["general", "business_or_bd"] as const;
const travelCategorySchema = z.enum(TRAVEL_CATEGORIES);

export const FLIGHT_TYPES = ["one_way", "round_trip", "multi_trip"] as const;
export const SEATING_PREFERENCES = ["window", "aisle", "other"] as const;
export const HOTEL_LOCATION_PREFERENCES = [
  "near_meeting",
  "near_airport",
] as const;

const flightTypeSchema = z.enum(FLIGHT_TYPES);
const seatingPreferenceSchema = z.enum(SEATING_PREFERENCES);
const hotelLocationPreferenceSchema = z.enum(HOTEL_LOCATION_PREFERENCES);

export const createTravelRequestSchema = z
  .object({
    origin: z.string().min(1, "Origin is required"),
    destination: z.string().min(1, "Destination is required"),
    purpose: z.string().min(1, "Purpose is required"),
    departureDate: dateString,
    returnDate: dateString,
    estimatedBudget: z.coerce.number().positive().optional(),
    cashAdvance: z.coerce.number().nonnegative().optional(),
    currency: currencyCodeSchema.default("USD"),
    category: travelCategorySchema.default("general"),
    flightType: flightTypeSchema.optional(),
    departureTimePreference: z.string().max(100).optional(),
    returnTimePreference: z.string().max(100).optional(),
    mealPreference: z.string().max(200).optional(),
    seatingPreference: seatingPreferenceSchema.optional(),
    seatingPreferenceOther: z.string().max(200).optional(),
    dummyTicketRequired: z.boolean().default(false),
    visaRequired: z.boolean().default(false),
    hotelRequired: z.boolean().default(false),
    hotelLocationPreference: hotelLocationPreferenceSchema.optional(),
    preferredHotel: z.string().max(200).optional(),
    hotelDetails: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((data) => data.returnDate >= data.departureDate, {
    message: "Return date must not be before departure date",
    path: ["returnDate"],
  })
  .refine(
    (data) =>
      data.cashAdvance === undefined ||
      data.estimatedBudget === undefined ||
      data.cashAdvance <= data.estimatedBudget,
    {
      message: "Cash advance must not exceed the estimated budget",
      path: ["cashAdvance"],
    },
  );

export const updateTravelRequestSchema = z
  .object({
    origin: z.string().min(1).optional(),
    destination: z.string().min(1).optional(),
    purpose: z.string().min(1).optional(),
    departureDate: dateString.optional(),
    returnDate: dateString.optional(),
    estimatedBudget: z.coerce.number().positive().optional(),
    cashAdvance: z.coerce.number().nonnegative().optional(),
    currency: currencyCodeSchema.optional(),
    category: travelCategorySchema.optional(),
    flightType: flightTypeSchema.optional(),
    departureTimePreference: z.string().max(100).optional(),
    returnTimePreference: z.string().max(100).optional(),
    mealPreference: z.string().max(200).optional(),
    seatingPreference: seatingPreferenceSchema.optional(),
    seatingPreferenceOther: z.string().max(200).optional(),
    dummyTicketRequired: z.boolean().optional(),
    visaRequired: z.boolean().optional(),
    hotelRequired: z.boolean().optional(),
    hotelLocationPreference: hotelLocationPreferenceSchema.optional(),
    preferredHotel: z.string().max(200).optional(),
    hotelDetails: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (data) => isValidOptionalYmdRange(data.departureDate, data.returnDate),
    {
      message: "Return date must not be before departure date",
      path: ["returnDate"],
    },
  )
  .refine(
    (data) =>
      data.cashAdvance === undefined ||
      data.estimatedBudget === undefined ||
      data.cashAdvance <= data.estimatedBudget,
    {
      message: "Cash advance must not exceed the estimated budget",
      path: ["cashAdvance"],
    },
  );

export const rejectTravelRequestSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(1000),
});

export const travelRequestQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    employeeId: z.string().uuid().optional(),
    entityId: z.string().optional(),
    status: z
      .enum([
        "draft",
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "completed",
        "archived",
      ])
      .optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    search: z.string().optional(),
  })
  .refine((q) => isValidOptionalYmdRange(q.startDate, q.endDate), {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const forwardTravelRequestSchema = z.object({
  delegateUserId: z.string().uuid(),
});

export const addAttachmentsSchema = z.object({
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        type: z.string().optional(),
      }),
    )
    .min(1),
});

export type CreateTravelRequestInput = z.infer<
  typeof createTravelRequestSchema
>;
export type ForwardTravelRequestInput = z.infer<
  typeof forwardTravelRequestSchema
>;
export type AddAttachmentsInput = z.infer<typeof addAttachmentsSchema>;
export type UpdateTravelRequestInput = z.infer<
  typeof updateTravelRequestSchema
>;
export type RejectTravelRequestInput = z.infer<
  typeof rejectTravelRequestSchema
>;
export type TravelRequestQuery = z.infer<typeof travelRequestQuerySchema>;

// `manager_l2` resolves to the submitter's skip-level manager
// (submitter.reportingTo.reportingTo) at submit time. The per-request
// decision snapshot stores the resolved user as `approverType="user"`
// so every downstream inbox / approve / reject path continues treating
// it as a fixed-user step. Steps that resolve to no L2 user
// (org-chart top) are auto-skipped on submit.
const approverTypeEnum = z.enum(["manager", "manager_l2", "user"]);

const approvalStepBase = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(2000).optional(),
  approverType: approverTypeEnum.default("manager"),
  approverUserId: z.string().uuid().optional().nullable(),
  // Submitter ids for whom this step is skipped entirely.
  skipWhenSubmitterIds: z.array(z.string().uuid()).default([]),
  // Submitter ids for whom this step is the only one that fires.
  // When non-empty, the step is skipped for everyone else.
  onlyWhenSubmitterIds: z.array(z.string().uuid()).default([]),
  // Category whitelist — apply only when request.category is in this
  // list. Empty list = no category filter (matches all categories).
  categoryFilter: z.array(travelCategorySchema).default([]),
  // THB amount band — apply only when the request's THB-equivalent
  // cashAdvance is in [min, max]. Either bound may be null.
  amountMinBaht: z.coerce.number().nonnegative().nullable().optional(),
  amountMaxBaht: z.coerce.number().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const createApprovalStepSchema = approvalStepBase.refine(
  (data) =>
    data.approverType !== "user" ||
    (data.approverUserId && data.approverUserId.length > 0),
  {
    message: "approverUserId is required when approverType is 'user'",
    path: ["approverUserId"],
  },
);

export const updateApprovalStepSchema = approvalStepBase
  .partial()
  .refine(
    (data) =>
      data.approverType !== "user" ||
      (data.approverUserId && data.approverUserId.length > 0),
    {
      message: "approverUserId is required when approverType is 'user'",
      path: ["approverUserId"],
    },
  );

export const reorderApprovalStepsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type CreateApprovalStepInput = z.infer<typeof createApprovalStepSchema>;
export type UpdateApprovalStepInput = z.infer<typeof updateApprovalStepSchema>;
export type ReorderApprovalStepsInput = z.infer<
  typeof reorderApprovalStepsSchema
>;
