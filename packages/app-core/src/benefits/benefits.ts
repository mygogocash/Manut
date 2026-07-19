import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

function toCalendarDate(value: string): string {
  return value.slice(0, 10);
}

const apiCalendarDateSchema = z.string().min(10).transform(toCalendarDate);

const nullableCalendarDateSchema = z.union([
  z.string().min(10).transform(toCalendarDate),
  z.null(),
]);

const apiMoneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value));

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export const benefitCategorySchema = z.enum([
  "health",
  "dental",
  "vision",
  "life",
  "retirement",
  "wellness",
  "other",
]);

const benefitCatalogApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: benefitCategorySchema,
    description: nullableText,
    provider: nullableText,
    cost: apiMoneySchema,
    currency: z.string().min(1),
    isActive: z.boolean(),
    entity: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .nullable()
      .optional(),
    _count: z
      .object({
        enrollments: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .passthrough();

export const benefitCatalogItemSchema = benefitCatalogApiSchema.transform(
  (benefit) => ({
    id: benefit.id,
    name: benefit.name,
    category: benefit.category,
    description: benefit.description,
    provider: benefit.provider,
    cost: benefit.cost,
    currency: benefit.currency,
    isActive: benefit.isActive,
    entityName: benefit.entity?.name ?? null,
    enrollmentCount: benefit._count?.enrollments ?? 0,
  }),
);

const benefitCatalogResponseSchema = z
  .object({
    data: z.array(benefitCatalogItemSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const myEnrollmentApiSchema = z
  .object({
    id: z.string().min(1),
    benefitId: z.string().min(1),
    status: z.string().min(1),
    startDate: apiCalendarDateSchema,
    endDate: nullableCalendarDateSchema,
    employee: z.unknown().optional(),
    benefit: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        category: benefitCategorySchema,
        provider: nullableText,
        cost: apiMoneySchema,
        currency: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export const myBenefitEnrollmentSchema = myEnrollmentApiSchema.transform(
  (enrollment) => ({
    id: enrollment.id,
    benefitId: enrollment.benefitId,
    status: enrollment.status,
    startDate: enrollment.startDate,
    endDate: enrollment.endDate,
    benefitName: enrollment.benefit.name,
    benefitCategory: enrollment.benefit.category,
    provider: enrollment.benefit.provider,
    cost: enrollment.benefit.cost,
    currency: enrollment.benefit.currency,
  }),
);

const myEnrollmentsResponseSchema = z
  .object({
    data: z.array(myBenefitEnrollmentSchema),
  })
  .strict();

export const benefitCatalogListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    category: benefitCategorySchema.optional(),
    entityId: z.string().min(1).optional(),
  })
  .strict();

export type BenefitCategory = z.infer<typeof benefitCategorySchema>;
export type BenefitCatalogItem = z.infer<typeof benefitCatalogItemSchema>;
export type BenefitCatalogListParams = z.input<
  typeof benefitCatalogListParamsSchema
>;
export type BenefitCatalogList = z.infer<typeof benefitCatalogResponseSchema>;
export type MyBenefitEnrollment = z.infer<typeof myBenefitEnrollmentSchema>;

export const enrollInBenefitInputSchema = z
  .object({
    benefitId: z.string().cuid("Invalid benefit ID"),
    employeeId: z.string().min(1).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  })
  .strict();

export type EnrollInBenefitInput = z.input<typeof enrollInBenefitInputSchema>;

const enrollInBenefitResponseSchema = z
  .object({
    data: myEnrollmentApiSchema,
  })
  .strict();

export const BENEFIT_CATALOG_QUERY_ROOT = ["benefits", "catalog"] as const;
export const MY_BENEFIT_ENROLLMENTS_QUERY_ROOT = [
  "benefits",
  "my-enrollments",
] as const;

export function benefitCatalogQueryKey(params: BenefitCatalogListParams = {}) {
  return [
    ...BENEFIT_CATALOG_QUERY_ROOT,
    benefitCatalogListParamsSchema.parse(params),
  ] as const;
}

export function myBenefitEnrollmentsQueryKey() {
  return [...MY_BENEFIT_ENROLLMENTS_QUERY_ROOT] as const;
}

function encodeBenefitQuery(
  params: z.output<typeof benefitCatalogListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["category", params.category],
    ["entityId", params.entityId],
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

export async function listBenefitCatalog(
  client: ApiClient,
  params: BenefitCatalogListParams = {},
  signal?: RequestAbortSignal,
): Promise<BenefitCatalogList> {
  const query = encodeBenefitQuery(benefitCatalogListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/benefits?${query}`,
    signal ? { signal } : undefined,
  );
  return benefitCatalogResponseSchema.parse(response);
}

export async function listMyBenefitEnrollments(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<MyBenefitEnrollment[]> {
  const response = await client.get<unknown>(
    "/benefits/my-enrollments",
    signal ? { signal } : undefined,
  );
  return myEnrollmentsResponseSchema.parse(response).data;
}

export async function enrollInBenefit(
  client: ApiClient,
  input: EnrollInBenefitInput,
): Promise<MyBenefitEnrollment> {
  const body = enrollInBenefitInputSchema.parse(input);
  const response = await client.post<unknown>("/benefits/enroll", body);
  const parsed = enrollInBenefitResponseSchema.parse(response);
  return myBenefitEnrollmentSchema.parse(parsed.data);
}
