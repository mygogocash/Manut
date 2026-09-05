import { PERMISSIONS } from "@nexora/contracts";
import type {
  AnnouncementSettingsInput,
  CreateSurveyInput,
  ListSurveysQuery,
  NotificationSettingsInput,
  PublishAnnounceInput,
  ReplaceQuestionsInput,
  ScheduleSurveyInput,
  SubmitResponseInput,
  SurveyQuestionInput,
  UpdateSurveyInput,
} from "@nexora/contracts/modules/survey/survey.validation";
import type { Db } from "@nexora/db";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import { announcePublishedForm } from "./announce";
import {
  isOpenNow,
  readAnnouncementDefaults,
  readNotificationRecipients,
  targetsUser,
  validateAnswerValue,
  type AnnouncementDefaults,
  type NotificationRecipients,
} from "./helpers";
import * as repo from "./survey.repository";
import * as settingsRepo from "./system-settings.repository";

const ANNOUNCE_SETTINGS_KEY = "survey.form.announcement_defaults";
const NOTIFY_SETTINGS_KEY = "survey.form.notification_recipients";

function canManage(perms: string[]) {
  return perms.includes(PERMISSIONS.SURVEY_MANAGE);
}

function questionInputToCreate(q: SurveyQuestionInput, order: number) {
  return {
    order,
    type: q.type,
    prompt: q.prompt,
    helperText: q.helperText ?? null,
    required: q.required,
    options: q.options,
    settings: q.settings,
  };
}

export async function list(db: Db, userId: string, userPermissions: string[], query: ListSurveysQuery) {
  const { page, limit, status, scope, archived } = query;
  const isManager = canManage(userPermissions);
  if (archived && !isManager) throw new ForbiddenException("Manager permission required");

  const filters: { status?: string; createdById?: string; archived?: boolean } = { archived };
  if (status) filters.status = status;
  if (scope === "mine") filters.createdById = userId;
  else if (scope === "all" && !isManager) throw new ForbiddenException("Manager permission required");
  else if (scope === "available") filters.status = "published";

  const { data, total } = await repo.findSurveys(db, filters, page, limit);

  if (scope === "available") {
    const user = await repo.findUserTargeting(db, userId);
    if (!user) return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
    const filtered = data.filter((f) => targetsUser(f, user) && isOpenNow(f));
    const formIds = filtered.map((f) => f.id);
    const myResponses = await repo.findResponsesBySurveyIds(db, formIds, userId);
    const respondedSet = new Set(myResponses.map((r) => r.surveyId));
    return {
      data: filtered.map((f) => ({ ...f, alreadyResponded: respondedSet.has(f.id) })),
      meta: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
    };
  }

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string, userId: string, userPermissions: string[]) {
  const form = await repo.findSurveyById(db, id);
  if (!form) throw new NotFoundException("Survey form not found");

  const isManager = canManage(userPermissions);
  const isOwner = form.createdById === userId;
  if (!isManager && !isOwner) {
    if (form.status !== "published") throw new ForbiddenException("Survey is not available");
    const user = await repo.findUserTargeting(db, userId);
    if (!user || !targetsUser(form, user)) {
      throw new ForbiddenException("You are not in this survey's audience");
    }
  }
  return form;
}

export async function create(db: Db, userId: string, input: CreateSurveyInput) {
  return repo.createSurvey(db, {
    title: input.title,
    description: input.description ?? null,
    isAnonymous: input.isAnonymous,
    targetAll: input.targetAll,
    targetEntityIds: input.targetEntityIds,
    targetDepartments: input.targetDepartments,
    targetUserIds: input.targetUserIds,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    createdById: userId,
    questions: input.questions.map((q, i) => questionInputToCreate(q, i + 1)),
  });
}

export async function update(db: Db, id: string, userId: string, input: UpdateSurveyInput) {
  const existing = await repo.findSurveyMeta(db, id);
  if (!existing) throw new NotFoundException("Survey form not found");
  if (existing.createdById !== userId) throw new ForbiddenException("You can only edit forms you created");
  if (existing.status !== "draft") {
    throw new BadRequestException(`Cannot edit a form with status "${existing.status}"`);
  }
  return repo.updateSurvey(db, id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.isAnonymous !== undefined && { isAnonymous: input.isAnonymous }),
    ...(input.targetAll !== undefined && { targetAll: input.targetAll }),
    ...(input.targetEntityIds !== undefined && { targetEntityIds: input.targetEntityIds }),
    ...(input.targetDepartments !== undefined && { targetDepartments: input.targetDepartments }),
    ...(input.targetUserIds !== undefined && { targetUserIds: input.targetUserIds }),
    ...(input.startDate !== undefined && { startDate: input.startDate ?? null }),
    ...(input.endDate !== undefined && { endDate: input.endDate ?? null }),
  });
}

export async function setSchedule(db: Db, id: string, userId: string, input: ScheduleSurveyInput) {
  const existing = await repo.findSurveyMeta(db, id);
  if (!existing) throw new NotFoundException("Survey form not found");
  if (existing.createdById !== userId) throw new ForbiddenException("You can only schedule forms you created");
  if (existing.status === "closed") throw new BadRequestException("Cannot change the schedule of a closed form");
  return repo.updateSurvey(db, id, {
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
  });
}

export async function replaceQuestions(db: Db, id: string, userId: string, input: ReplaceQuestionsInput) {
  const existing = await repo.findSurveyMeta(db, id);
  if (!existing) throw new NotFoundException("Survey form not found");
  if (existing.createdById !== userId) throw new ForbiddenException("You can only edit forms you created");
  if (existing.status !== "draft") {
    throw new BadRequestException(`Cannot edit questions on a "${existing.status}" form`);
  }
  const updated = await repo.replaceSurveyQuestions(
    db,
    id,
    input.questions.map((q, i) => questionInputToCreate(q, i + 1)),
  );
  if (!updated) throw new NotFoundException("Survey form not found");
  return updated;
}

export async function remove(db: Db, id: string, userId: string) {
  const existing = await repo.findSurveyMeta(db, id);
  if (!existing) throw new NotFoundException("Survey form not found");
  if (existing.createdById !== userId) throw new ForbiddenException("You can only delete forms you created");
  if (existing.status === "published") {
    throw new BadRequestException("Close the survey before deleting it; published forms keep responses");
  }
  await repo.deleteSurvey(db, id);
}

export async function publish(
  db: Db,
  id: string,
  userId: string,
  permissions: string[] = [],
  announce?: PublishAnnounceInput,
) {
  const existing = await repo.findSurveyMeta(db, id);
  if (!existing) throw new NotFoundException("Survey form not found");
  if (existing.createdById !== userId) throw new ForbiddenException("Only the creator can publish");
  if (existing.status !== "draft") throw new BadRequestException(`Cannot publish a "${existing.status}" form`);
  const qCount = await repo.countSurveyQuestions(db, id);
  if (qCount === 0) throw new BadRequestException("Add at least one question before publishing");

  const updated = await repo.updateSurvey(db, id, {
    status: "published",
    publishedAt: new Date().toISOString(),
  });
  if (announce) {
    await announcePublishedForm(db, { id, title: existing.title }, userId, permissions, announce);
  }
  return updated;
}

export async function getAnnouncementDefaults(db: Db): Promise<AnnouncementDefaults> {
  const value = await settingsRepo.getSetting(db, ANNOUNCE_SETTINGS_KEY);
  return readAnnouncementDefaults(value);
}

export async function setAnnouncementDefaults(db: Db, input: AnnouncementSettingsInput): Promise<AnnouncementDefaults> {
  const clean = readAnnouncementDefaults(input);
  await settingsRepo.upsertSetting(db, ANNOUNCE_SETTINGS_KEY, {
    wall: clean.wall,
    news: clean.news,
    companyDate: clean.companyDate,
    messageTemplate: clean.messageTemplate,
    newsCategory: clean.newsCategory,
  });
  return clean;
}

export async function getNotificationRecipients(db: Db): Promise<NotificationRecipients> {
  const value = await settingsRepo.getSetting(db, NOTIFY_SETTINGS_KEY);
  return readNotificationRecipients(value);
}

export async function setNotificationRecipients(
  db: Db,
  input: NotificationSettingsInput,
): Promise<NotificationRecipients> {
  const clean = readNotificationRecipients(input);
  await settingsRepo.upsertSetting(db, NOTIFY_SETTINGS_KEY, { recipients: clean.recipients });
  return clean;
}

export async function announceNow(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  announce: PublishAnnounceInput,
): Promise<{ posted: string[] }> {
  const form = await repo.findSurveyMeta(db, id);
  if (!form) throw new NotFoundException("Survey form not found");
  if (form.createdById !== userId) throw new ForbiddenException("Only the creator can announce the survey");
  if (form.status === "draft") throw new BadRequestException("Publish the survey before announcing it");
  const posted = await announcePublishedForm(db, { id: form.id, title: form.title }, userId, permissions, announce);
  return { posted };
}

function assertCanManageStatus(
  existing: { createdById: string },
  userId: string,
  permissions: string[],
  action: string,
): void {
  if (existing.createdById !== userId && !permissions.includes(PERMISSIONS.SURVEY_MANAGE)) {
    throw new ForbiddenException(`Only the creator or a survey manager can ${action} the survey`);
  }
}

export async function close(db: Db, id: string, userId: string, permissions: string[]) {
  const existing = await repo.findSurveyMeta(db, id);
  if (!existing) throw new NotFoundException("Survey form not found");
  assertCanManageStatus(existing, userId, permissions, "close");
  if (existing.status !== "published") throw new BadRequestException(`Cannot close a "${existing.status}" form`);
  return repo.updateSurvey(db, id, { status: "closed", closedAt: new Date().toISOString() });
}

export async function reopen(db: Db, id: string, userId: string, permissions: string[]) {
  const existing = await repo.findSurveyMeta(db, id);
  if (!existing) throw new NotFoundException("Survey form not found");
  assertCanManageStatus(existing, userId, permissions, "reopen");
  if (existing.archivedAt) throw new BadRequestException("Unarchive the survey before reopening it");
  if (existing.status !== "closed") throw new BadRequestException(`Cannot reopen a "${existing.status}" form`);
  return repo.updateSurvey(db, id, { status: "published", closedAt: null });
}

export async function archive(db: Db, id: string, userId: string) {
  const existing = await repo.findSurveyMeta(db, id);
  if (!existing) throw new NotFoundException("Survey form not found");
  if (existing.createdById !== userId) throw new ForbiddenException("Only the creator can archive the survey");
  if (existing.archivedAt) throw new BadRequestException("Survey is already archived");
  return repo.updateSurvey(db, id, { archivedAt: new Date().toISOString() });
}

export async function unarchive(db: Db, id: string, userId: string) {
  const existing = await repo.findSurveyMeta(db, id);
  if (!existing) throw new NotFoundException("Survey form not found");
  if (existing.createdById !== userId) throw new ForbiddenException("Only the creator can restore the survey");
  if (!existing.archivedAt) throw new BadRequestException("Survey is not archived");
  return repo.updateSurvey(db, id, { archivedAt: null });
}

export async function submitResponse(db: Db, id: string, userId: string, input: SubmitResponseInput) {
  const form = await repo.findSurveyWithQuestions(db, id);
  if (!form) throw new NotFoundException("Survey form not found");
  if (form.status !== "published") {
    throw new BadRequestException(`Cannot submit a response to a "${form.status}" form`);
  }

  const user = await repo.findUserTargeting(db, userId);
  if (!user) throw new ForbiddenException("Unknown user");
  if (!targetsUser(form, user)) throw new ForbiddenException("You are not in this survey's audience");

  if (!form.isAnonymous) {
    const existing = await repo.findMyResponse(db, id, userId);
    if (existing) throw new BadRequestException("You have already responded to this survey");
  }

  const answersByQuestion = new Map<string, unknown>();
  for (const a of input.answers) answersByQuestion.set(a.questionId, a.value);

  const validatedRows: Array<{ questionId: string; value: unknown }> = [];
  for (const q of form.questions) {
    const raw = answersByQuestion.get(q.id);
    const validated = validateAnswerValue(q.type, q.options, q.required, raw);
    if (validated !== null) validatedRows.push({ questionId: q.id, value: validated });
    else if (q.required) throw new BadRequestException(`Question "${q.prompt}" is required`);
  }

  const saved = await repo.createSurveyResponse(db, {
    surveyId: form.id,
    respondentId: form.isAnonymous ? null : userId,
    answers: validatedRows,
  });

  void notifyFormSubmission(db, form, userId).catch((err) => {
    console.error(JSON.stringify({ level: "error", event: "survey_submission_notify_failed", formId: form.id, err: String(err) }));
  });

  return saved;
}

async function notifyFormSubmission(
  db: Db,
  form: { id: string; title: string; createdById: string; isAnonymous: boolean },
  respondentId: string,
) {
  // Email adapter not wired on edge yet — resolve recipients for future send.
  const configured = (await getNotificationRecipients(db)).recipients;
  let emails: string[];
  if (configured.length > 0) {
    const ownerEmail = await repo.findUserEmail(db, form.createdById);
    emails = [...new Set([...(ownerEmail ? [ownerEmail] : []), ...configured])];
  } else {
    emails = await repo.findNotificationEmails(db, form.createdById);
  }
  if (emails.length === 0) return;

  let respondentName = "Anonymous";
  if (!form.isAnonymous) {
    respondentName = (await repo.findUserName(db, respondentId)) ?? "An employee";
  }
  const responseCount = await repo.countSurveyResponses(db, form.id);
  void responseCount;
  void respondentName;
  // TODO: wire sendEmail when edge email adapter lands (template: survey-form-response-submitted)
}

export async function getMyResponse(db: Db, id: string, userId: string) {
  const form = await repo.findSurveyMeta(db, id);
  if (!form) throw new NotFoundException("Survey form not found");
  if (form.isAnonymous) return null;
  return repo.findMyResponse(db, id, userId);
}

export async function listResponses(db: Db, id: string, userId: string, userPermissions: string[]) {
  const form = await repo.findSurveyMeta(db, id);
  if (!form) throw new NotFoundException("Survey form not found");
  if (form.createdById !== userId && !canManage(userPermissions)) {
    throw new ForbiddenException("Only the creator can view responses");
  }
  return repo.listSurveyResponses(db, id, form.isAnonymous);
}

export async function getAnalytics(db: Db, id: string, userId: string, userPermissions: string[]) {
  const form = await repo.findSurveyById(db, id);
  if (!form) throw new NotFoundException("Survey form not found");
  if (form.createdById !== userId && !canManage(userPermissions)) {
    throw new ForbiddenException("Only the creator can view analytics");
  }

  const allAnswers = await repo.listSurveyAnswersForAnalytics(db, id);
  const byQuestion = new Map<string, unknown[]>();
  for (const a of allAnswers) {
    const arr = byQuestion.get(a.questionId) ?? [];
    arr.push(a.value);
    byQuestion.set(a.questionId, arr);
  }

  const questionStats = form.questions
    .filter((q) => q.type !== "info")
    .map((q) => {
      const values = byQuestion.get(q.id) ?? [];
      const base = { id: q.id, prompt: q.prompt, type: q.type, responses: values.length };

      if (q.type === "single_choice") {
        const counts: Record<string, number> = {};
        for (const v of values) if (typeof v === "string") counts[v] = (counts[v] ?? 0) + 1;
        return { ...base, kind: "choice" as const, counts };
      }
      if (q.type === "multi_choice") {
        const counts: Record<string, number> = {};
        for (const v of values) {
          if (Array.isArray(v)) {
            for (const item of v) if (typeof item === "string") counts[item] = (counts[item] ?? 0) + 1;
          }
        }
        return { ...base, kind: "choice" as const, counts };
      }
      if (q.type === "rating" || q.type === "number") {
        const nums = values.filter((v): v is number => typeof v === "number");
        const sum = nums.reduce((a, b) => a + b, 0);
        const avg = nums.length === 0 ? null : sum / nums.length;
        return {
          ...base,
          kind: "numeric" as const,
          average: avg,
          min: nums.length === 0 ? null : Math.min(...nums),
          max: nums.length === 0 ? null : Math.max(...nums),
        };
      }
      const samples = values.filter((v): v is string => typeof v === "string").slice(0, 50);
      return { ...base, kind: "text" as const, samples };
    });

  return { totalResponses: form._count.responses, questions: questionStats };
}
