import { HttpError } from "../http-error";
import type {
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
  };
}

export type SurveyEngineService = ReturnType<typeof createSurveyEngineService>;
