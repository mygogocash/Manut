import {
  createPrismaClient,
  type InputJsonValue,
  type PrismaClient,
} from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import type {
  AnnouncementDefaults,
  NotificationRecipients,
  QuestionInput,
  SurveyFormRecord,
  SurveyKind,
  SurveyQuestionRecord,
  SurveyStore,
} from "./store";

const DEFAULT_ANNOUNCEMENT: AnnouncementDefaults = {
  wall: true,
  news: true,
  companyDate: true,
  messageTemplate:
    'New survey: "{title}" is now open. Share your input on the Intranet.',
  newsCategory: "Survey",
};

function settingsKeys(kind: SurveyKind): {
  announce: string;
  notify: string;
} {
  // Mirror Express: classic survey uses `survey.form.*`; wave forms use `survey.*`.
  if (kind === "survey-form") {
    return {
      announce: "survey.announcement_defaults",
      notify: "survey.notification_recipients",
    };
  }
  return {
    announce: "survey.form.announcement_defaults",
    notify: "survey.form.notification_recipients",
  };
}

function readAnnouncementDefaults(value: unknown): AnnouncementDefaults {
  const record = (value ?? {}) as Record<string, unknown>;
  const str = (entry: unknown, fallback: string) =>
    typeof entry === "string" && entry.trim() ? entry : fallback;
  const bool = (entry: unknown, fallback: boolean) =>
    typeof entry === "boolean" ? entry : fallback;
  return {
    wall: bool(record.wall, DEFAULT_ANNOUNCEMENT.wall),
    news: bool(record.news, DEFAULT_ANNOUNCEMENT.news),
    companyDate: bool(record.companyDate, DEFAULT_ANNOUNCEMENT.companyDate),
    messageTemplate: str(
      record.messageTemplate,
      DEFAULT_ANNOUNCEMENT.messageTemplate,
    ),
    newsCategory: str(record.newsCategory, DEFAULT_ANNOUNCEMENT.newsCategory),
  };
}

function readNotificationRecipients(value: unknown): NotificationRecipients {
  const record = (value ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(record.recipients) ? record.recipients : [];
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const clean = entry.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      recipients.push(clean);
    }
  }
  return { recipients };
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapQuestion(raw: {
  id: string;
  order: number;
  type: string;
  prompt: string;
  helperText: string | null;
  required: boolean;
  options: unknown;
  settings: unknown;
}): SurveyQuestionRecord {
  return {
    id: raw.id,
    order: raw.order,
    type: raw.type,
    prompt: raw.prompt,
    helperText: raw.helperText,
    required: raw.required,
    options: raw.options,
    settings: raw.settings,
  };
}

function mapForm(raw: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  isAnonymous: boolean;
  targetAll: boolean;
  targetEntityIds: unknown;
  targetDepartments: unknown;
  targetUserIds: unknown;
  publishedAt: Date | null;
  closedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  archivedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  questions: Array<{
    id: string;
    order: number;
    type: string;
    prompt: string;
    helperText: string | null;
    required: boolean;
    options: unknown;
    settings: unknown;
  }>;
  _count: { questions: number; responses: number };
}): SurveyFormRecord {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    status: raw.status,
    isAnonymous: raw.isAnonymous,
    targetAll: raw.targetAll,
    targetEntityIds: raw.targetEntityIds,
    targetDepartments: raw.targetDepartments,
    targetUserIds: raw.targetUserIds,
    publishedAt: raw.publishedAt ? asIso(raw.publishedAt) : null,
    closedAt: raw.closedAt ? asIso(raw.closedAt) : null,
    startDate: raw.startDate,
    endDate: raw.endDate,
    archivedAt: raw.archivedAt ? asIso(raw.archivedAt) : null,
    createdById: raw.createdById,
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    questions: raw.questions.map(mapQuestion),
    questionCount: raw._count.questions,
    responseCount: raw._count.responses,
  };
}

const FORM_INCLUDES = {
  questions: { orderBy: { order: "asc" as const } },
  _count: { select: { responses: true, questions: true } },
};

const ADMIN_EXTRAS = ["survey:manage", "survey:manage-wave"] as const;

export function createPrismaSurveyStore(
  client: PrismaClient,
  kind: SurveyKind,
): SurveyStore {
  const isWave = kind === "survey-form";
  const keys = settingsKeys(kind);

  return {
    async loadPermissions(userId) {
      return loadUserPermissions(client, userId, ADMIN_EXTRAS);
    },

    async findAudienceUser(userId) {
      const user = await client.user.findUnique({
        where: { id: userId },
        select: { id: true, entityId: true, department: true },
      });
      return user;
    },

    async findMany(filters, page, limit) {
      const where: Record<string, unknown> = {
        archivedAt: filters.archived ? { not: null } : null,
      };
      if (filters.status) where.status = filters.status;
      if (filters.scope === "mine" && filters.createdById) {
        where.createdById = filters.createdById;
      } else if (filters.scope === "available") {
        where.status = "published";
      }

      if (isWave) {
        const [data, total] = await Promise.all([
          client.surveyForm.findMany({
            where,
            include: FORM_INCLUDES,
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
          }),
          client.surveyForm.count({ where }),
        ]);
        return { data: data.map(mapForm), total };
      }

      const [data, total] = await Promise.all([
        client.survey.findMany({
          where,
          include: FORM_INCLUDES,
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.survey.count({ where }),
      ]);
      return { data: data.map(mapForm), total };
    },

    async findRespondedFormIds(formIds, userId) {
      if (formIds.length === 0) return new Set();
      if (isWave) {
        const rows = await client.surveyFormResponse.findMany({
          where: { surveyFormId: { in: formIds }, respondentId: userId },
          select: { surveyFormId: true },
        });
        return new Set(rows.map((row) => row.surveyFormId));
      }
      const rows = await client.surveyResponse.findMany({
        where: { surveyId: { in: formIds }, respondentId: userId },
        select: { surveyId: true },
      });
      return new Set(rows.map((row) => row.surveyId));
    },

    async findById(id) {
      if (isWave) {
        const row = await client.surveyForm.findUnique({
          where: { id },
          include: FORM_INCLUDES,
        });
        return row ? mapForm(row) : null;
      }
      const row = await client.survey.findUnique({
        where: { id },
        include: FORM_INCLUDES,
      });
      return row ? mapForm(row) : null;
    },

    async create(input) {
      const targeting = {
        targetEntityIds: input.targetEntityIds as InputJsonValue,
        targetDepartments: input.targetDepartments as InputJsonValue,
        targetUserIds: input.targetUserIds as InputJsonValue,
      };
      if (isWave) {
        const row = await client.surveyForm.create({
          data: {
            title: input.title,
            description: input.description,
            isAnonymous: input.isAnonymous,
            targetAll: input.targetAll,
            ...targeting,
            createdById: input.createdById,
          },
          include: FORM_INCLUDES,
        });
        return mapForm(row);
      }
      const row = await client.survey.create({
        data: {
          title: input.title,
          description: input.description,
          isAnonymous: input.isAnonymous,
          targetAll: input.targetAll,
          ...targeting,
          createdById: input.createdById,
        },
        include: FORM_INCLUDES,
      });
      return mapForm(row);
    },

    async replaceQuestions(id, questions: QuestionInput[]) {
      if (isWave) {
        return client.$transaction(async (tx) => {
          await tx.surveyFormQuestion.deleteMany({
            where: { surveyFormId: id },
          });
          await tx.surveyFormQuestion.createMany({
            data: questions.map((question, index) => ({
              surveyFormId: id,
              order: index + 1,
              type: question.type,
              prompt: question.prompt,
              helperText: question.helperText,
              required: question.required,
              options: question.options as InputJsonValue,
              settings: question.settings as InputJsonValue,
            })),
          });
          const row = await tx.surveyForm.findUnique({
            where: { id },
            include: FORM_INCLUDES,
          });
          return row ? mapForm(row) : null;
        });
      }

      return client.$transaction(async (tx) => {
        await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });
        await tx.surveyQuestion.createMany({
          data: questions.map((question, index) => ({
            surveyId: id,
            order: index + 1,
            type: question.type,
            prompt: question.prompt,
            helperText: question.helperText,
            required: question.required,
            options: question.options as InputJsonValue,
            settings: question.settings as InputJsonValue,
          })),
        });
        const row = await tx.survey.findUnique({
          where: { id },
          include: FORM_INCLUDES,
        });
        return row ? mapForm(row) : null;
      });
    },

    async publish(id) {
      if (isWave) {
        const row = await client.surveyForm.update({
          where: { id },
          data: { status: "published", publishedAt: new Date() },
          include: FORM_INCLUDES,
        });
        return mapForm(row);
      }
      const row = await client.survey.update({
        where: { id },
        data: { status: "published", publishedAt: new Date() },
        include: FORM_INCLUDES,
      });
      return mapForm(row);
    },

    async setSchedule(id, input) {
      const data = {
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      };
      if (isWave) {
        const row = await client.surveyForm.update({
          where: { id },
          data,
          include: FORM_INCLUDES,
        });
        return mapForm(row);
      }
      const row = await client.survey.update({
        where: { id },
        data,
        include: FORM_INCLUDES,
      });
      return mapForm(row);
    },

    async close(id) {
      const data = { status: "closed", closedAt: new Date() };
      if (isWave) {
        const row = await client.surveyForm.update({
          where: { id },
          data,
          include: FORM_INCLUDES,
        });
        return mapForm(row);
      }
      const row = await client.survey.update({
        where: { id },
        data,
        include: FORM_INCLUDES,
      });
      return mapForm(row);
    },

    async reopen(id) {
      const data = { status: "published", closedAt: null };
      if (isWave) {
        const row = await client.surveyForm.update({
          where: { id },
          data,
          include: FORM_INCLUDES,
        });
        return mapForm(row);
      }
      const row = await client.survey.update({
        where: { id },
        data,
        include: FORM_INCLUDES,
      });
      return mapForm(row);
    },

    async archive(id) {
      const data = { archivedAt: new Date() };
      if (isWave) {
        const row = await client.surveyForm.update({
          where: { id },
          data,
          include: FORM_INCLUDES,
        });
        return mapForm(row);
      }
      const row = await client.survey.update({
        where: { id },
        data,
        include: FORM_INCLUDES,
      });
      return mapForm(row);
    },

    async unarchive(id) {
      const data = { archivedAt: null };
      if (isWave) {
        const row = await client.surveyForm.update({
          where: { id },
          data,
          include: FORM_INCLUDES,
        });
        return mapForm(row);
      }
      const row = await client.survey.update({
        where: { id },
        data,
        include: FORM_INCLUDES,
      });
      return mapForm(row);
    },

    async listResponses(formId) {
      if (isWave) {
        const rows = await client.surveyFormResponse.findMany({
          where: { surveyFormId: formId },
          include: {
            respondent: {
              select: { id: true, name: true, department: true },
            },
            answers: true,
          },
          orderBy: { submittedAt: "desc" },
        });
        return rows.map((row) => ({
          id: row.id,
          formId: row.surveyFormId,
          respondentId: row.respondentId,
          respondentName: row.respondent?.name ?? null,
          respondentDepartment: row.respondent?.department ?? null,
          submittedAt: asIso(row.submittedAt),
          answers: row.answers.map((answer) => ({
            questionId: answer.questionId,
            value: answer.value,
          })),
        }));
      }
      const rows = await client.surveyResponse.findMany({
        where: { surveyId: formId },
        include: {
          respondent: {
            select: { id: true, name: true, department: true },
          },
          answers: true,
        },
        orderBy: { submittedAt: "desc" },
      });
      return rows.map((row) => ({
        id: row.id,
        formId: row.surveyId,
        respondentId: row.respondentId,
        respondentName: row.respondent?.name ?? null,
        respondentDepartment: row.respondent?.department ?? null,
        submittedAt: asIso(row.submittedAt),
        answers: row.answers.map((answer) => ({
          questionId: answer.questionId,
          value: answer.value,
        })),
      }));
    },

    async listAnswerValues(formId) {
      if (isWave) {
        const rows = await client.surveyFormAnswer.findMany({
          where: { question: { surveyFormId: formId } },
          select: { questionId: true, value: true },
        });
        return rows.map((row) => ({
          questionId: row.questionId,
          value: row.value,
        }));
      }
      const rows = await client.surveyAnswer.findMany({
        where: { question: { surveyId: formId } },
        select: { questionId: true, value: true },
      });
      return rows.map((row) => ({
        questionId: row.questionId,
        value: row.value,
      }));
    },

    async getAnnouncementDefaults() {
      const row = await client.systemSetting.findUnique({
        where: { key: keys.announce },
      });
      return readAnnouncementDefaults(row?.value);
    },

    async setAnnouncementDefaults(input) {
      const clean = readAnnouncementDefaults(input);
      const value = {
        wall: clean.wall,
        news: clean.news,
        companyDate: clean.companyDate,
        messageTemplate: clean.messageTemplate,
        newsCategory: clean.newsCategory,
      } as InputJsonValue;
      await client.systemSetting.upsert({
        where: { key: keys.announce },
        update: { value },
        create: { key: keys.announce, value },
      });
      return clean;
    },

    async getNotificationRecipients() {
      const row = await client.systemSetting.findUnique({
        where: { key: keys.notify },
      });
      return readNotificationRecipients(row?.value);
    },

    async setNotificationRecipients(input) {
      const clean = readNotificationRecipients(input);
      const value = { recipients: clean.recipients } as InputJsonValue;
      await client.systemSetting.upsert({
        where: { key: keys.notify },
        update: { value },
        create: { key: keys.notify, value },
      });
      return clean;
    },

    async findMyResponse(formId, userId) {
      if (isWave) {
        const row = await client.surveyFormResponse.findUnique({
          where: {
            surveyFormId_respondentId: {
              surveyFormId: formId,
              respondentId: userId,
            },
          },
          include: { answers: true },
        });
        if (!row) return null;
        return {
          id: row.id,
          formId: row.surveyFormId,
          respondentId: row.respondentId,
          submittedAt: asIso(row.submittedAt),
          answers: row.answers.map((answer) => ({
            questionId: answer.questionId,
            value: answer.value,
          })),
        };
      }
      const row = await client.surveyResponse.findUnique({
        where: {
          surveyId_respondentId: {
            surveyId: formId,
            respondentId: userId,
          },
        },
        include: { answers: true },
      });
      if (!row) return null;
      return {
        id: row.id,
        formId: row.surveyId,
        respondentId: row.respondentId,
        submittedAt: asIso(row.submittedAt),
        answers: row.answers.map((answer) => ({
          questionId: answer.questionId,
          value: answer.value,
        })),
      };
    },

    async hasResponse(formId, userId) {
      if (isWave) {
        const row = await client.surveyFormResponse.findUnique({
          where: {
            surveyFormId_respondentId: {
              surveyFormId: formId,
              respondentId: userId,
            },
          },
          select: { id: true },
        });
        return row !== null;
      }
      const row = await client.surveyResponse.findUnique({
        where: {
          surveyId_respondentId: {
            surveyId: formId,
            respondentId: userId,
          },
        },
        select: { id: true },
      });
      return row !== null;
    },

    async createResponse(input) {
      if (isWave) {
        return client.$transaction(async (tx) => {
          const response = await tx.surveyFormResponse.create({
            data: {
              surveyFormId: input.formId,
              respondentId: input.respondentId,
            },
          });
          if (input.answers.length > 0) {
            await tx.surveyFormAnswer.createMany({
              data: input.answers.map((answer) => ({
                responseId: response.id,
                questionId: answer.questionId,
                value: answer.value as never,
              })),
            });
          }
          const saved = await tx.surveyFormResponse.findUnique({
            where: { id: response.id },
            include: { answers: true },
          });
          if (!saved) {
            throw new Error("Failed to load survey-form response");
          }
          return {
            id: saved.id,
            formId: saved.surveyFormId,
            respondentId: saved.respondentId,
            submittedAt: asIso(saved.submittedAt),
            answers: saved.answers.map((answer) => ({
              questionId: answer.questionId,
              value: answer.value,
            })),
          };
        });
      }

      return client.$transaction(async (tx) => {
        const response = await tx.surveyResponse.create({
          data: {
            surveyId: input.formId,
            respondentId: input.respondentId,
          },
        });
        if (input.answers.length > 0) {
          await tx.surveyAnswer.createMany({
            data: input.answers.map((answer) => ({
              responseId: response.id,
              questionId: answer.questionId,
              value: answer.value as never,
            })),
          });
        }
        const saved = await tx.surveyResponse.findUnique({
          where: { id: response.id },
          include: { answers: true },
        });
        if (!saved) {
          throw new Error("Failed to load survey response");
        }
        return {
          id: saved.id,
          formId: saved.surveyId,
          respondentId: saved.respondentId,
          submittedAt: asIso(saved.submittedAt),
          answers: saved.answers.map((answer) => ({
            questionId: answer.questionId,
            value: answer.value,
          })),
        };
      });
    },
  };
}

export function createHyperdriveSurveyStore(
  env: RuntimeBindings,
  kind: SurveyKind,
): SurveyStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaSurveyStore(client, kind);
}
