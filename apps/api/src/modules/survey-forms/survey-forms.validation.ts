import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

// End date must not precede start date when both are set.
const dateOrderRefine = (d: {
  startDate?: string | null;
  endDate?: string | null;
}) =>
  !d.startDate ||
  !d.endDate ||
  Date.parse(d.endDate) >= Date.parse(d.startDate);

const dateOrderIssue = {
  message: "End date must not be before start date",
  path: ["endDate"],
};

export const QUESTION_TYPES = [
  "info",
  "short_text",
  "long_text",
  "single_choice",
  "multi_choice",
  "rating",
  "date",
  "number",
] as const;

const questionTypeEnum = z.enum(QUESTION_TYPES);

const questionSettingsSchema = z
  .object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  })
  .partial()
  .catchall(z.unknown());

export const surveyFormQuestionSchema = z
  .object({
    type: questionTypeEnum,
    prompt: z.string().min(1, "Prompt is required").max(500),
    helperText: z.string().max(500).optional().nullable(),
    required: z.boolean().default(false),
    options: z.array(z.string().min(1).max(200)).default([]),
    settings: questionSettingsSchema.default({}),
  })
  .superRefine((data, ctx) => {
    if (data.type === "info") return;
    const choiceTypes: ReadonlyArray<string> = [
      "single_choice",
      "multi_choice",
    ];
    if (choiceTypes.includes(data.type) && data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Choice questions need at least two options",
      });
    }
  });

export type SurveyFormQuestionInput = z.infer<typeof surveyFormQuestionSchema>;

export const createSurveyFormSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(5000).optional().nullable(),
    isAnonymous: z.boolean().default(false),
    targetAll: z.boolean().default(true),
    targetEntityIds: z.array(z.string()).default([]),
    targetDepartments: z.array(z.string().max(120)).default([]),
    targetUserIds: z.array(z.string().uuid()).default([]),
    questions: z.array(surveyFormQuestionSchema).default([]),
    startDate: dateString.nullish(),
    endDate: dateString.nullish(),
  })
  .refine(dateOrderRefine, dateOrderIssue);

export const updateSurveyFormSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    isAnonymous: z.boolean().optional(),
    targetAll: z.boolean().optional(),
    targetEntityIds: z.array(z.string()).optional(),
    targetDepartments: z.array(z.string().max(120)).optional(),
    targetUserIds: z.array(z.string().uuid()).optional(),
    startDate: dateString.nullish(),
    endDate: dateString.nullish(),
  })
  .refine(dateOrderRefine, dateOrderIssue);

// Schedule-only update — allowed on draft AND published forms so HR can
// set or extend the open/close window without reopening the editor.
export const scheduleSurveyFormSchema = z
  .object({
    startDate: dateString.nullish(),
    endDate: dateString.nullish(),
  })
  .refine(dateOrderRefine, dateOrderIssue);

export const replaceQuestionsSchema = z.object({
  questions: z
    .array(surveyFormQuestionSchema)
    .min(1, "Add at least one question"),
});

export const submitResponseSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        // Polymorphic. Anything coercible to JSON is accepted; the
        // service does the type-by-type validation against the
        // question's declared type so the schema can stay flexible.
        value: z
          .union([
            z.string(),
            z.number(),
            z.boolean(),
            z.array(z.string()),
            z.null(),
          ])
          .optional(),
      }),
    )
    .min(0),
});

export const listSurveyFormsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["draft", "published", "closed"]).optional(),
  scope: z.enum(["mine", "all", "available"]).default("available"),
  // When "true", return ONLY archived forms (manager-only). Anything else
  // (incl. absent) excludes archived from every scope. Explicit string
  // compare — z.coerce.boolean() would turn "false" into true.
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

// Optional "announce on publish" block. Each surface is opt-in; the
// service additionally checks the actor holds the matching permission
// before writing to it. The notification bell is automatic (a read-model
// over published+targeted+unanswered forms) so it has no flag here.
export const publishSurveyFormSchema = z.object({
  announce: z
    .object({
      wall: z.boolean().default(false),
      news: z.boolean().default(false),
      companyDate: z.boolean().default(false),
      message: z.string().max(5000).optional(),
      deadline: z
        .string()
        .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
        .optional(),
    })
    .optional(),
});

// Admin-editable defaults for the announce-on-publish dialog.
export const announcementSettingsSchema = z.object({
  wall: z.boolean(),
  news: z.boolean(),
  companyDate: z.boolean(),
  messageTemplate: z.string().max(2000),
  newsCategory: z.string().min(1).max(120),
});

// Admin-editable recipient list for new-response notification emails.
export const notificationSettingsSchema = z.object({
  recipients: z.array(z.string().trim().email()).max(50),
});

export type CreateSurveyFormInput = z.infer<typeof createSurveyFormSchema>;
export type UpdateSurveyFormInput = z.infer<typeof updateSurveyFormSchema>;
export type ReplaceQuestionsInput = z.infer<typeof replaceQuestionsSchema>;
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
export type ListSurveyFormsQuery = z.infer<typeof listSurveyFormsSchema>;
export type PublishSurveyFormInput = z.infer<typeof publishSurveyFormSchema>;
export type PublishAnnounceInput = NonNullable<
  PublishSurveyFormInput["announce"]
>;
export type AnnouncementSettingsInput = z.infer<
  typeof announcementSettingsSchema
>;
export type NotificationSettingsInput = z.infer<
  typeof notificationSettingsSchema
>;
export type ScheduleSurveyFormInput = z.infer<typeof scheduleSurveyFormSchema>;

export const _dateGuard = dateString; // kept for type cohesion if added later
