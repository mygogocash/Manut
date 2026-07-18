import { HttpError } from "../http-error";
import type {
  AnnouncementDefaults,
  NotificationRecipients,
  QuestionInput,
  SurveyFormRecord,
  SurveyStore,
} from "./store";
import {
  isOpenNow,
  SURVEY_QUESTION_TYPES,
  targetsUser,
  validateAnswerValue,
} from "./targeting";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export interface SurveyEngineConfig {
  managePermission: string;
  notFoundMessage: string;
}

function asIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function asIsoDate(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/**
 * Client projection: strip creator email, target ids, and raw response counts
 * beyond questionCount (matches app-core survey schemas).
 */
function serializeForm(
  raw: SurveyFormRecord,
  alreadyResponded?: boolean,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    status: raw.status,
    isAnonymous: raw.isAnonymous,
    publishedAt: asIso(raw.publishedAt),
    closedAt: asIso(raw.closedAt),
    startDate: asIsoDate(raw.startDate),
    endDate: asIsoDate(raw.endDate),
    _count: {
      questions: raw.questionCount,
      responses: raw.responseCount,
    },
    questions: raw.questions.map((question) => ({
      id: question.id,
      order: question.order,
      type: question.type,
      prompt: question.prompt,
      helperText: question.helperText,
      required: question.required,
      options: Array.isArray(question.options) ? question.options : [],
      settings:
        typeof question.settings === "object" && question.settings !== null
          ? question.settings
          : {},
    })),
  };
  if (alreadyResponded !== undefined) {
    base.alreadyResponded = alreadyResponded;
  }
  return base;
}

function assertPermission(permissions: Set<string>, permission: string): void {
  if (!permissions.has(permission)) {
    throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
  }
}

function parseQuestionInputs(raw: unknown): QuestionInput[] {
  if (typeof raw !== "object" || raw === null || !("questions" in raw)) {
    throw new HttpError(400, "INVALID_SURVEY", "questions are required.");
  }
  const questions = (raw as { questions: unknown }).questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new HttpError(
      400,
      "INVALID_SURVEY",
      "Add at least one question.",
    );
  }

  return questions.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new HttpError(
        400,
        "INVALID_SURVEY",
        `Question ${index + 1} is invalid.`,
      );
    }
    const record = entry as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "";
    if (!SURVEY_QUESTION_TYPES.has(type)) {
      throw new HttpError(400, "INVALID_SURVEY", `Invalid question type: ${type}`);
    }
    const prompt =
      typeof record.prompt === "string" ? record.prompt.trim() : "";
    if (!prompt) {
      throw new HttpError(400, "INVALID_SURVEY", "Prompt is required.");
    }
    const options = Array.isArray(record.options)
      ? record.options.filter((opt): opt is string => typeof opt === "string")
      : [];
    if (
      (type === "single_choice" || type === "multi_choice") &&
      options.length < 2
    ) {
      throw new HttpError(
        400,
        "INVALID_SURVEY",
        "Choice questions need at least two options.",
      );
    }
    return {
      type,
      prompt,
      helperText:
        typeof record.helperText === "string" ? record.helperText.trim() : null,
      required: record.required === true,
      options,
      settings:
        typeof record.settings === "object" &&
        record.settings !== null &&
        !Array.isArray(record.settings)
          ? (record.settings as Record<string, unknown>)
          : {},
    };
  });
}

export function createSurveyEngineService(
  store: SurveyStore,
  config: SurveyEngineConfig,
) {
  return {
    async list(
      userId: string,
      query: {
        page: number;
        limit: number;
        status?: string;
        scope: "available" | "mine" | "all";
        archived: boolean;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      const isManager = permissions.has(config.managePermission);

      if (query.archived && !isManager) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Manager permission required.",
        );
      }
      if (query.scope === "all" && !isManager) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Manager permission required.",
        );
      }

      const { data, total } = await store.findMany(
        {
          status: query.status,
          scope: query.scope,
          archived: query.archived,
          createdById: query.scope === "mine" ? userId : undefined,
        },
        query.page,
        query.limit,
      );

      if (query.scope !== "available") {
        return {
          data: data.map((row) => serializeForm(row)),
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
        };
      }

      const user = await store.findAudienceUser(userId);
      if (!user) {
        return {
          data: [],
          meta: {
            page: query.page,
            limit: query.limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      const filtered = data.filter(
        (form) => targetsUser(form, user) && isOpenNow(form),
      );
      const responded = await store.findRespondedFormIds(
        filtered.map((form) => form.id),
        userId,
      );

      return {
        data: filtered.map((form) =>
          serializeForm(form, responded.has(form.id)),
        ),
        meta: {
          page: query.page,
          limit: query.limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / query.limit),
        },
      };
    },

    async getById(userId: string, id: string) {
      const permissions = await store.loadPermissions(userId);
      const form = await store.findById(id);
      if (!form) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }

      const isManager = permissions.has(config.managePermission);
      const isOwner = form.createdById === userId;
      if (!isManager && !isOwner) {
        if (form.status !== "published") {
          throw new HttpError(403, "FORBIDDEN", "Survey is not available.");
        }
        const user = await store.findAudienceUser(userId);
        if (!user || !targetsUser(form, user)) {
          throw new HttpError(
            403,
            "FORBIDDEN",
            "You are not in this survey's audience.",
          );
        }
      }

      return { data: serializeForm(form) };
    },

    async create(
      userId: string,
      input: {
        title: string;
        description?: string | null;
        isAnonymous?: boolean;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const title = input.title.trim();
      if (!title) {
        throw new HttpError(400, "INVALID_SURVEY", "Title is required.");
      }

      const created = await store.create({
        title,
        description: input.description?.trim() || null,
        isAnonymous: input.isAnonymous === true,
        targetAll: true,
        targetEntityIds: [],
        targetDepartments: [],
        targetUserIds: [],
        createdById: userId,
      });

      return { data: serializeForm(created) };
    },

    async replaceQuestions(userId: string, id: string, body: unknown) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const existing = await store.findById(id);
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      if (existing.createdById !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only edit forms you created.",
        );
      }
      if (existing.status !== "draft") {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          `Cannot edit questions on a "${existing.status}" form.`,
        );
      }

      const questions = parseQuestionInputs(body);
      const updated = await store.replaceQuestions(id, questions);
      if (!updated) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      return { data: serializeForm(updated) };
    },

    async publish(userId: string, id: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const existing = await store.findById(id);
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      if (existing.createdById !== userId) {
        throw new HttpError(403, "FORBIDDEN", "Only the creator can publish.");
      }
      if (existing.status !== "draft") {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          `Cannot publish a "${existing.status}" form.`,
        );
      }
      if (existing.questionCount === 0) {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          "Add at least one question before publishing.",
        );
      }

      // Announce / wall / news side-effects stay on Express (proxy publish?announce).
      const updated = await store.publish(id);
      if (!updated) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      return { data: serializeForm(updated) };
    },

    async submitResponse(userId: string, id: string, body: unknown) {
      const form = await store.findById(id);
      if (!form) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      if (form.status !== "published") {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          `Cannot submit a response to a "${form.status}" form.`,
        );
      }

      const user = await store.findAudienceUser(userId);
      if (!user) {
        throw new HttpError(403, "FORBIDDEN", "Unknown user.");
      }
      if (!targetsUser(form, user)) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You are not in this survey's audience.",
        );
      }

      if (!form.isAnonymous && (await store.hasResponse(form.id, userId))) {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          "You have already responded to this survey.",
        );
      }

      const answersRaw =
        typeof body === "object" &&
        body !== null &&
        "answers" in body &&
        Array.isArray((body as { answers: unknown }).answers)
          ? (body as { answers: unknown[] }).answers
          : [];

      const answersByQuestion = new Map<string, unknown>();
      for (const entry of answersRaw) {
        if (typeof entry !== "object" || entry === null) continue;
        const record = entry as Record<string, unknown>;
        if (typeof record.questionId === "string") {
          answersByQuestion.set(record.questionId, record.value);
        }
      }

      const validatedRows: Array<{ questionId: string; value: unknown }> = [];
      for (const question of form.questions) {
        const raw = answersByQuestion.get(question.id);
        try {
          const validated = validateAnswerValue(
            question.type,
            question.options,
            question.required,
            raw,
          );
          if (validated !== null) {
            validatedRows.push({ questionId: question.id, value: validated });
          }
        } catch (error) {
          throw new HttpError(
            400,
            "INVALID_SURVEY",
            error instanceof Error ? error.message : "Invalid answer.",
          );
        }
      }

      // Email notification stays on Express; edge persists the response only.
      const saved = await store.createResponse({
        formId: form.id,
        respondentId: form.isAnonymous ? null : userId,
        answers: validatedRows,
      });

      return {
        data: {
          id: saved.id,
          answers: saved.answers,
          submittedAt: asIso(saved.submittedAt),
        },
      };
    },

    async getMyResponse(userId: string, id: string) {
      const form = await store.findById(id);
      if (!form) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      if (form.isAnonymous) {
        return { data: null };
      }
      const response = await store.findMyResponse(id, userId);
      if (!response) {
        return { data: null };
      }
      return {
        data: {
          id: response.id,
          answers: response.answers,
          submittedAt: asIso(response.submittedAt),
        },
      };
    },

    async setSchedule(userId: string, id: string, body: unknown) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const existing = await store.findById(id);
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      if (existing.createdById !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only schedule forms you created.",
        );
      }
      if (existing.status === "closed") {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          "Cannot change the schedule of a closed form.",
        );
      }

      const record =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : {};
      const startDate =
        record.startDate === null || record.startDate === undefined
          ? null
          : typeof record.startDate === "string"
            ? record.startDate
            : null;
      const endDate =
        record.endDate === null || record.endDate === undefined
          ? null
          : typeof record.endDate === "string"
            ? record.endDate
            : null;

      if (startDate && Number.isNaN(Date.parse(startDate))) {
        throw new HttpError(400, "INVALID_SURVEY", "Invalid startDate.");
      }
      if (endDate && Number.isNaN(Date.parse(endDate))) {
        throw new HttpError(400, "INVALID_SURVEY", "Invalid endDate.");
      }
      if (startDate && endDate && startDate > endDate) {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          "endDate must be on or after startDate.",
        );
      }

      const updated = await store.setSchedule(id, { startDate, endDate });
      if (!updated) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      return { data: serializeForm(updated) };
    },

    async close(userId: string, id: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const existing = await store.findById(id);
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      assertCanManageStatus(
        existing,
        userId,
        permissions,
        config.managePermission,
        "close",
      );
      if (existing.status !== "published") {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          `Cannot close a "${existing.status}" form.`,
        );
      }

      const updated = await store.close(id);
      if (!updated) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      return { data: serializeForm(updated) };
    },

    async reopen(userId: string, id: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const existing = await store.findById(id);
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      assertCanManageStatus(
        existing,
        userId,
        permissions,
        config.managePermission,
        "reopen",
      );
      if (existing.archivedAt) {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          "Unarchive the survey before reopening it.",
        );
      }
      if (existing.status !== "closed") {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          `Cannot reopen a "${existing.status}" form.`,
        );
      }

      const updated = await store.reopen(id);
      if (!updated) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      return { data: serializeForm(updated) };
    },

    async archive(userId: string, id: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const existing = await store.findById(id);
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      if (existing.createdById !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Only the creator can archive the survey.",
        );
      }
      if (existing.archivedAt) {
        throw new HttpError(
          400,
          "INVALID_SURVEY",
          "Survey is already archived.",
        );
      }

      const updated = await store.archive(id);
      if (!updated) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      return { data: serializeForm(updated) };
    },

    async unarchive(userId: string, id: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const existing = await store.findById(id);
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      if (existing.createdById !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Only the creator can restore the survey.",
        );
      }
      if (!existing.archivedAt) {
        throw new HttpError(400, "INVALID_SURVEY", "Survey is not archived.");
      }

      const updated = await store.unarchive(id);
      if (!updated) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      return { data: serializeForm(updated) };
    },

    async listResponses(userId: string, id: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const form = await store.findById(id);
      if (!form) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      if (
        form.createdById !== userId &&
        !permissions.has(config.managePermission)
      ) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Only the creator can view responses.",
        );
      }

      const rows = await store.listResponses(id);
      return {
        data: rows.map((row) => {
          const base: Record<string, unknown> = {
            id: row.id,
            submittedAt: asIso(row.submittedAt),
            answers: row.answers,
          };
          if (!form.isAnonymous && row.respondentId) {
            // Strip email — Express includes it; edge client projection does not.
            base.respondent = {
              id: row.respondentId,
              name: row.respondentName,
              department: row.respondentDepartment,
            };
          }
          return base;
        }),
      };
    },

    async getAnalytics(userId: string, id: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);

      const form = await store.findById(id);
      if (!form) {
        throw new HttpError(404, "NOT_FOUND", config.notFoundMessage);
      }
      if (
        form.createdById !== userId &&
        !permissions.has(config.managePermission)
      ) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Only the creator can view analytics.",
        );
      }

      const allAnswers = await store.listAnswerValues(id);
      const byQuestion = new Map<string, unknown[]>();
      for (const answer of allAnswers) {
        const values = byQuestion.get(answer.questionId) ?? [];
        values.push(answer.value);
        byQuestion.set(answer.questionId, values);
      }

      const questions = form.questions
        .filter((question) => question.type !== "info")
        .map((question) => {
          const values = byQuestion.get(question.id) ?? [];
          const base = {
            id: question.id,
            prompt: question.prompt,
            type: question.type,
            responses: values.length,
          };

          if (question.type === "single_choice") {
            const counts: Record<string, number> = {};
            for (const value of values) {
              if (typeof value === "string") {
                counts[value] = (counts[value] ?? 0) + 1;
              }
            }
            return { ...base, kind: "choice" as const, counts };
          }
          if (question.type === "multi_choice") {
            const counts: Record<string, number> = {};
            for (const value of values) {
              if (Array.isArray(value)) {
                for (const item of value) {
                  if (typeof item === "string") {
                    counts[item] = (counts[item] ?? 0) + 1;
                  }
                }
              }
            }
            return { ...base, kind: "choice" as const, counts };
          }
          if (question.type === "rating" || question.type === "number") {
            const nums = values.filter(
              (value): value is number => typeof value === "number",
            );
            const sum = nums.reduce((acc, next) => acc + next, 0);
            return {
              ...base,
              kind: "numeric" as const,
              average: nums.length === 0 ? null : sum / nums.length,
              min: nums.length === 0 ? null : Math.min(...nums),
              max: nums.length === 0 ? null : Math.max(...nums),
            };
          }
          const samples = values
            .filter((value): value is string => typeof value === "string")
            .slice(0, 50);
          return { ...base, kind: "text" as const, samples };
        });

      return {
        data: {
          totalResponses: form.responseCount,
          questions,
        },
      };
    },

    async getAnnouncementDefaults(userId: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);
      return { data: await store.getAnnouncementDefaults() };
    },

    async setAnnouncementDefaults(userId: string, body: unknown) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);
      const input = parseAnnouncementDefaults(body);
      return { data: await store.setAnnouncementDefaults(input) };
    },

    async getNotificationRecipients(userId: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);
      return { data: await store.getNotificationRecipients() };
    },

    async setNotificationRecipients(userId: string, body: unknown) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, config.managePermission);
      const input = parseNotificationRecipients(body);
      return { data: await store.setNotificationRecipients(input) };
    },
  };
}

function assertCanManageStatus(
  existing: { createdById: string },
  userId: string,
  permissions: Set<string>,
  managePermission: string,
  action: string,
): void {
  if (
    existing.createdById !== userId &&
    !permissions.has(managePermission)
  ) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      `Only the creator or a survey manager can ${action} the survey.`,
    );
  }
}

function parseAnnouncementDefaults(body: unknown): AnnouncementDefaults {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(
      400,
      "INVALID_SURVEY",
      "Announcement settings body is required.",
    );
  }
  const record = body as Record<string, unknown>;
  if (
    typeof record.wall !== "boolean" ||
    typeof record.news !== "boolean" ||
    typeof record.companyDate !== "boolean" ||
    typeof record.messageTemplate !== "string" ||
    typeof record.newsCategory !== "string" ||
    !record.newsCategory.trim()
  ) {
    throw new HttpError(
      400,
      "INVALID_SURVEY",
      "Invalid announcement settings payload.",
    );
  }
  if (record.messageTemplate.length > 2000) {
    throw new HttpError(
      400,
      "INVALID_SURVEY",
      "messageTemplate is too long.",
    );
  }
  return {
    wall: record.wall,
    news: record.news,
    companyDate: record.companyDate,
    messageTemplate: record.messageTemplate,
    newsCategory: record.newsCategory.trim(),
  };
}

function parseNotificationRecipients(body: unknown): NotificationRecipients {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(
      400,
      "INVALID_SURVEY",
      "Notification settings body is required.",
    );
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.recipients)) {
    throw new HttpError(
      400,
      "INVALID_SURVEY",
      "recipients must be an array of emails.",
    );
  }
  if (record.recipients.length > 50) {
    throw new HttpError(
      400,
      "INVALID_SURVEY",
      "At most 50 notification recipients.",
    );
  }
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const entry of record.recipients) {
    if (typeof entry !== "string") {
      throw new HttpError(400, "INVALID_SURVEY", "Invalid recipient email.");
    }
    const clean = entry.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      throw new HttpError(400, "INVALID_SURVEY", "Invalid recipient email.");
    }
    if (!seen.has(clean)) {
      seen.add(clean);
      recipients.push(clean);
    }
  }
  return { recipients };
}

export type SurveyEngineService = ReturnType<typeof createSurveyEngineService>;
