import type { Prisma } from "@nexora/database";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { surveyFormSubmittedEmail } from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import { companyDatesService } from "@/modules/company-dates/company-dates.service";
import { newsService } from "@/modules/news/news.service";
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
} from "@/modules/survey/survey.validation";
import { wallService } from "@/modules/wall/wall.service";

const FORM_INCLUDES = {
  createdBy: { select: { id: true, name: true, email: true } },
  questions: {
    orderBy: { order: "asc" as const },
  },
  _count: { select: { responses: true, questions: true } },
};

// Admin-editable defaults for the "announce on publish" dialog, stored as
// a single SystemSetting row. The publish dialog pre-fills from these; the
// service falls back to DEFAULT_ANNOUNCEMENT when the row is absent.
const ANNOUNCE_SETTINGS_KEY = "survey.form.announcement_defaults";

export interface AnnouncementDefaults {
  wall: boolean;
  news: boolean;
  companyDate: boolean;
  messageTemplate: string;
  newsCategory: string;
}

const DEFAULT_ANNOUNCEMENT: AnnouncementDefaults = {
  wall: true,
  news: true,
  companyDate: true,
  messageTemplate:
    'New survey: "{title}" is now open. Share your input on the Manut.',
  newsCategory: "Survey",
};

// Type-guard each field on read so a malformed row can't crash publish.
function readAnnouncementDefaults(value: unknown): AnnouncementDefaults {
  const v = (value ?? {}) as Record<string, unknown>;
  const str = (x: unknown, fallback: string) =>
    typeof x === "string" && x.trim() ? x : fallback;
  const bool = (x: unknown, fallback: boolean) =>
    typeof x === "boolean" ? x : fallback;
  return {
    wall: bool(v.wall, DEFAULT_ANNOUNCEMENT.wall),
    news: bool(v.news, DEFAULT_ANNOUNCEMENT.news),
    companyDate: bool(v.companyDate, DEFAULT_ANNOUNCEMENT.companyDate),
    messageTemplate: str(
      v.messageTemplate,
      DEFAULT_ANNOUNCEMENT.messageTemplate,
    ),
    newsCategory: str(v.newsCategory, DEFAULT_ANNOUNCEMENT.newsCategory),
  };
}

function asArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

// Admin-editable recipient list for new-response notification emails, stored
// as a single SystemSetting row (independent of the Awards module's list).
// Empty list → fall back to the owner + Admin/HR roles (see notifyFormSubmission).
const NOTIFY_SETTINGS_KEY = "survey.form.notification_recipients";

export interface NotificationRecipients {
  recipients: string[];
}

// Normalize on read: lowercase + trim + dedupe, drop blanks.
function readNotificationRecipients(value: unknown): NotificationRecipients {
  const v = (value ?? {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const raw of asArray(v.recipients)) {
    const clean = raw.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      recipients.push(clean);
    }
  }
  return { recipients };
}

function canManage(perms: string[]) {
  return perms.includes(PERMISSIONS.SURVEY_MANAGE);
}

export function targetsUser(
  form: {
    targetAll: boolean;
    targetEntityIds: unknown;
    targetDepartments: unknown;
    targetUserIds: unknown;
  },
  user: { id: string; entityId: string | null; department: string | null },
): boolean {
  if (form.targetAll) return true;
  const userIds = asArray(form.targetUserIds);
  if (userIds.includes(user.id)) return true;
  const entityIds = asArray(form.targetEntityIds);
  if (user.entityId && entityIds.includes(user.entityId)) return true;
  const departments = asArray(form.targetDepartments);
  if (user.department && departments.includes(user.department)) return true;
  return false;
}

// A published form is only fillable inside its [startDate, endDate] window
// (inclusive, day granularity). Compared as UTC YYYY-MM-DD to avoid TZ skew.
export function isOpenNow(form: {
  startDate: Date | null;
  endDate: Date | null;
}): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (form.startDate && form.startDate.toISOString().slice(0, 10) > today) {
    return false;
  }
  if (form.endDate && form.endDate.toISOString().slice(0, 10) < today) {
    return false;
  }
  return true;
}

function validateAnswerValue(
  type: string,
  options: unknown,
  required: boolean,
  value: unknown,
): unknown {
  // Treat empty string / empty array as missing.
  const isMissing =
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0);
  if (type === "info") return null;

  if (isMissing) {
    if (required) {
      throw new BadRequestException("Answer is required");
    }
    return null;
  }

  switch (type) {
    case "short_text":
    case "long_text": {
      if (typeof value !== "string") {
        throw new BadRequestException("Text answer must be a string");
      }
      const max = type === "short_text" ? 500 : 5000;
      if (value.length > max) {
        throw new BadRequestException(
          `Answer exceeds the ${max}-character limit`,
        );
      }
      return value;
    }
    case "single_choice": {
      if (typeof value !== "string") {
        throw new BadRequestException("Choice answer must be a string");
      }
      const opts = asArray(options);
      if (!opts.includes(value)) {
        throw new BadRequestException(
          "Selected option is not part of the question",
        );
      }
      return value;
    }
    case "multi_choice": {
      if (!Array.isArray(value)) {
        throw new BadRequestException("Multi-choice answer must be an array");
      }
      const opts = asArray(options);
      const arr = value.filter((v): v is string => typeof v === "string");
      for (const v of arr) {
        if (!opts.includes(v)) {
          throw new BadRequestException(
            `Selected option "${v}" is not part of the question`,
          );
        }
      }
      return arr;
    }
    case "rating":
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) {
        throw new BadRequestException("Numeric answer is not a number");
      }
      return n;
    }
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException("Date answer must be YYYY-MM-DD");
      }
      return value;
    }
    default:
      throw new BadRequestException(`Unknown question type: ${type}`);
  }
}

export class SurveyService {
  async list(
    userId: string,
    userPermissions: string[],
    query: ListSurveysQuery,
  ) {
    const { page, limit, status, scope, archived } = query;
    const isManager = canManage(userPermissions);

    if (archived && !isManager) {
      throw new ForbiddenException("Manager permission required");
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    // Archived is orthogonal to status: hide archived everywhere by
    // default, or show ONLY archived when explicitly requested.
    where.archivedAt = archived ? { not: null } : null;

    if (scope === "mine") {
      where.createdById = userId;
    } else if (scope === "all" && !isManager) {
      throw new ForbiddenException("Manager permission required");
    } else if (scope === "available") {
      // Restrict to forms the user can actually fill in.
      where.status = "published";
    }

    const [data, total] = await Promise.all([
      prisma.survey.findMany({
        where,
        include: FORM_INCLUDES,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.survey.count({ where }),
    ]);

    let filtered = data;
    if (scope === "available") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, entityId: true, department: true },
      });
      if (!user) {
        return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      filtered = data.filter((f) => targetsUser(f, user) && isOpenNow(f));
      // Annotate with whether the user has already responded so the
      // FE can disable the "Open" button for completed forms.
      const formIds = filtered.map((f) => f.id);
      const myResponses =
        formIds.length > 0
          ? await prisma.surveyResponse.findMany({
              where: { surveyId: { in: formIds }, respondentId: userId },
              select: { surveyId: true },
            })
          : [];
      const respondedSet = new Set(myResponses.map((r) => r.surveyId));
      return {
        data: filtered.map((f) => ({
          ...f,
          alreadyResponded: respondedSet.has(f.id),
        })),
        meta: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      };
    }

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, userPermissions: string[]) {
    const form = await prisma.survey.findUnique({
      where: { id },
      include: FORM_INCLUDES,
    });
    if (!form) throw new NotFoundException("Survey form not found");

    const isManager = canManage(userPermissions);
    const isOwner = form.createdById === userId;
    if (!isManager && !isOwner) {
      // Employees can only see published forms targeted at them.
      if (form.status !== "published") {
        throw new ForbiddenException("Survey is not available");
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, entityId: true, department: true },
      });
      if (!user || !targetsUser(form, user)) {
        throw new ForbiddenException("You are not in this survey's audience");
      }
    }

    return form;
  }

  async create(userId: string, input: CreateSurveyInput) {
    const form = await prisma.survey.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        isAnonymous: input.isAnonymous,
        targetAll: input.targetAll,
        targetEntityIds: input.targetEntityIds,
        targetDepartments: input.targetDepartments,
        targetUserIds: input.targetUserIds,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        createdById: userId,
        questions: {
          create: input.questions.map((q, i) =>
            this.questionInputToCreate(q, i + 1),
          ),
        },
      },
      include: FORM_INCLUDES,
    });
    return form;
  }

  async update(id: string, userId: string, input: UpdateSurveyInput) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, createdById: true, status: true },
    });
    if (!existing) throw new NotFoundException("Survey form not found");
    if (existing.createdById !== userId) {
      throw new ForbiddenException("You can only edit forms you created");
    }
    if (existing.status !== "draft") {
      throw new BadRequestException(
        `Cannot edit a form with status "${existing.status}"`,
      );
    }

    return prisma.survey.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.isAnonymous !== undefined && {
          isAnonymous: input.isAnonymous,
        }),
        ...(input.targetAll !== undefined && { targetAll: input.targetAll }),
        ...(input.targetEntityIds !== undefined && {
          targetEntityIds: input.targetEntityIds,
        }),
        ...(input.targetDepartments !== undefined && {
          targetDepartments: input.targetDepartments,
        }),
        ...(input.targetUserIds !== undefined && {
          targetUserIds: input.targetUserIds,
        }),
        ...(input.startDate !== undefined && {
          startDate: input.startDate ? new Date(input.startDate) : null,
        }),
        ...(input.endDate !== undefined && {
          endDate: input.endDate ? new Date(input.endDate) : null,
        }),
      },
      include: FORM_INCLUDES,
    });
  }

  // Set or extend the open/close window. Unlike update(), this is allowed
  // on published forms too — HR's "extend the deadline" path. Blocked once
  // a form is closed/archived (no point scheduling a dead form).
  async setSchedule(id: string, userId: string, input: ScheduleSurveyInput) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, createdById: true, status: true },
    });
    if (!existing) throw new NotFoundException("Survey form not found");
    if (existing.createdById !== userId) {
      throw new ForbiddenException("You can only schedule forms you created");
    }
    if (existing.status === "closed") {
      throw new BadRequestException(
        "Cannot change the schedule of a closed form",
      );
    }
    return prisma.survey.update({
      where: { id },
      data: {
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      },
      include: FORM_INCLUDES,
    });
  }

  async replaceQuestions(
    id: string,
    userId: string,
    input: ReplaceQuestionsInput,
  ) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, createdById: true, status: true },
    });
    if (!existing) throw new NotFoundException("Survey form not found");
    if (existing.createdById !== userId) {
      throw new ForbiddenException("You can only edit forms you created");
    }
    if (existing.status !== "draft") {
      throw new BadRequestException(
        `Cannot edit questions on a "${existing.status}" form`,
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });
      await tx.surveyQuestion.createMany({
        data: input.questions.map((q, i) => ({
          surveyId: id,
          ...this.questionInputToCreate(q, i + 1),
        })),
      });
      return tx.survey.findUnique({
        where: { id },
        include: FORM_INCLUDES,
      });
    });
  }

  async delete(id: string, userId: string) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, createdById: true, status: true },
    });
    if (!existing) throw new NotFoundException("Survey form not found");
    if (existing.createdById !== userId) {
      throw new ForbiddenException("You can only delete forms you created");
    }
    if (existing.status === "published") {
      throw new BadRequestException(
        "Close the survey before deleting it; published forms keep responses",
      );
    }
    return prisma.survey.delete({ where: { id } });
  }

  async publish(
    id: string,
    userId: string,
    permissions: string[] = [],
    announce?: PublishAnnounceInput,
  ) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!existing) throw new NotFoundException("Survey form not found");
    if (existing.createdById !== userId) {
      throw new ForbiddenException("Only the creator can publish");
    }
    if (existing.status !== "draft") {
      throw new BadRequestException(
        `Cannot publish a "${existing.status}" form`,
      );
    }
    if (existing._count.questions === 0) {
      throw new BadRequestException(
        "Add at least one question before publishing",
      );
    }
    const updated = await prisma.survey.update({
      where: { id },
      data: { status: "published", publishedAt: new Date() },
      include: FORM_INCLUDES,
    });

    if (announce) {
      // Best-effort broadcast — never let a side-effect failure roll back
      // the publish. Each surface is gated on the actor's own permission.
      await this.announcePublishedForm(
        { id, title: existing.title },
        userId,
        permissions,
        announce,
      );
    }

    return updated;
  }

  async getAnnouncementDefaults(): Promise<AnnouncementDefaults> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: ANNOUNCE_SETTINGS_KEY },
    });
    return readAnnouncementDefaults(row?.value);
  }

  async setAnnouncementDefaults(
    input: AnnouncementSettingsInput,
  ): Promise<AnnouncementDefaults> {
    const clean = readAnnouncementDefaults(input);
    const value: Prisma.InputJsonObject = {
      wall: clean.wall,
      news: clean.news,
      companyDate: clean.companyDate,
      messageTemplate: clean.messageTemplate,
      newsCategory: clean.newsCategory,
    };
    await prisma.systemSetting.upsert({
      where: { key: ANNOUNCE_SETTINGS_KEY },
      update: { value },
      create: { key: ANNOUNCE_SETTINGS_KEY, value },
    });
    return clean;
  }

  async getNotificationRecipients(): Promise<NotificationRecipients> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: NOTIFY_SETTINGS_KEY },
    });
    return readNotificationRecipients(row?.value);
  }

  async setNotificationRecipients(
    input: NotificationSettingsInput,
  ): Promise<NotificationRecipients> {
    const clean = readNotificationRecipients(input);
    const value: Prisma.InputJsonObject = { recipients: clean.recipients };
    await prisma.systemSetting.upsert({
      where: { key: NOTIFY_SETTINGS_KEY },
      update: { value },
      create: { key: NOTIFY_SETTINGS_KEY, value },
    });
    return clean;
  }

  private buildAnnounceMessage(
    title: string,
    custom: string | undefined,
    template: string,
  ): string {
    const base =
      custom?.trim() || template || DEFAULT_ANNOUNCEMENT.messageTemplate;
    return base.replace(/\{title\}/g, title);
  }

  // Idempotent "ensure this survey has a deep-linked card on a surface".
  // Re-announcing must REPAIR existing cards, not pile up duplicates, so the
  // order is deliberate:
  //   1. repairLegacy — backfill `link_url` on any card that matches this
  //      form but has a null link (posted before deep-linking shipped, or by
  //      an old re-announce that created unlinked rows). Fixes ALL such rows.
  //   2. countLinked — if a card is already linked to this form, stop (no dup).
  //   3. create — first-ever announce on this surface: post + link.
  // Each call is best-effort; failures are logged, never thrown, so one dead
  // surface can't abort the others.
  private async ensureSurfaceLinked(opts: {
    repairLegacy: () => Promise<number>;
    countLinked: () => Promise<number>;
    create: () => Promise<void>;
  }): Promise<void> {
    if ((await opts.repairLegacy()) > 0) return;
    if ((await opts.countLinked()) > 0) return;
    await opts.create();
  }

  // Returns the surfaces ensured (created or repaired), so callers can give
  // the user feedback. Idempotent — safe to re-run via `announceNow`.
  private async announcePublishedForm(
    form: { id: string; title: string },
    userId: string,
    permissions: string[],
    announce: PublishAnnounceInput,
  ): Promise<string[]> {
    const defaults = await this.getAnnouncementDefaults();
    const message = this.buildAnnounceMessage(
      form.title,
      announce.message,
      defaults.messageTemplate,
    );
    const posted: string[] = [];
    // In-app deep link so the announcement is a one-click path to the form.
    const respondLink = `/survey/${form.id}/respond`;

    if (announce.wall && permissions.includes(PERMISSIONS.WALL_CREATE)) {
      try {
        await this.ensureSurfaceLinked({
          // Wall bodies are a customizable template, so there's no exact title
          // to key on — identify legacy survey posts by their "survey" type +
          // the form title appearing in the body. (A form title that is a
          // substring of another could theoretically over-match; titles are
          // distinct enough in practice.)
          repairLegacy: async () =>
            (
              await prisma.wallPost.updateMany({
                where: {
                  type: "survey",
                  linkUrl: null,
                  content: { contains: form.title },
                },
                data: { linkUrl: respondLink },
              })
            ).count,
          countLinked: () =>
            prisma.wallPost.count({ where: { linkUrl: respondLink } }),
          create: async () => {
            const post = await wallService.createPost(userId, {
              content: message,
              type: "survey",
            });
            await prisma.wallPost.update({
              where: { id: post.id },
              data: { linkUrl: respondLink },
            });
          },
        });
        posted.push("Company Wall");
      } catch (err) {
        logger.warn("survey announce: wall post failed", {
          err,
          formId: form.id,
        });
      }
    }

    if (announce.news && permissions.includes(PERMISSIONS.NEWS_CREATE)) {
      try {
        const newsTitle = `New survey: ${form.title}`;
        await this.ensureSurfaceLinked({
          repairLegacy: async () =>
            (
              await prisma.companyNews.updateMany({
                where: { title: newsTitle, linkUrl: null },
                data: { linkUrl: respondLink },
              })
            ).count,
          countLinked: () =>
            prisma.companyNews.count({ where: { linkUrl: respondLink } }),
          create: async () => {
            const news = await newsService.createNews(userId, {
              title: newsTitle,
              content: message,
              category: defaults.newsCategory,
              isPinned: false,
            });
            await prisma.companyNews.update({
              where: { id: news.id },
              data: { linkUrl: respondLink },
            });
          },
        });
        posted.push("Company News");
      } catch (err) {
        logger.warn("survey announce: news item failed", {
          err,
          formId: form.id,
        });
      }
    }

    if (
      announce.companyDate &&
      announce.deadline &&
      permissions.includes(PERMISSIONS.ADMIN_MANAGE)
    ) {
      try {
        const dateTitle = `Survey closes: ${form.title}`;
        // Capture into a local — control-flow narrowing of `announce.deadline`
        // doesn't carry into the `create` closure below.
        const deadline = announce.deadline;
        await this.ensureSurfaceLinked({
          repairLegacy: async () =>
            (
              await prisma.companyDate.updateMany({
                where: { title: dateTitle, linkUrl: null },
                data: { linkUrl: respondLink },
              })
            ).count,
          countLinked: () =>
            prisma.companyDate.count({ where: { linkUrl: respondLink } }),
          create: async () => {
            const date = await companyDatesService.create(userId, {
              title: dateTitle,
              date: deadline,
              type: "Survey",
            });
            await prisma.companyDate.update({
              where: { id: date.id },
              data: { linkUrl: respondLink },
            });
          },
        });
        posted.push("Company Dates");
      } catch (err) {
        logger.warn("survey announce: company date failed", {
          err,
          formId: form.id,
        });
      }
    }

    return posted;
  }

  // Re-announce an already-published form on demand (the publish-time
  // announce only fires once). Idempotent: repairs the deep link on existing
  // cards in place rather than duplicating them — the fix for surveys
  // announced before deep-linking shipped (their cards had a null link_url).
  async announceNow(
    id: string,
    userId: string,
    permissions: string[],
    announce: PublishAnnounceInput,
  ): Promise<{ posted: string[] }> {
    const form = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, title: true, createdById: true, status: true },
    });
    if (!form) throw new NotFoundException("Survey form not found");
    if (form.createdById !== userId) {
      throw new ForbiddenException("Only the creator can announce the survey");
    }
    if (form.status === "draft") {
      throw new BadRequestException("Publish the survey before announcing it");
    }
    const posted = await this.announcePublishedForm(
      { id: form.id, title: form.title },
      userId,
      permissions,
      announce,
    );
    return { posted };
  }

  // Close (published → closed) / reopen (closed → published) are status
  // controls any survey manager (admin / HR via `survey:manage`) can use,
  // not just the form's creator — mirrors the owner-or-manage RBAC pattern.
  private assertCanManageStatus(
    existing: { createdById: string },
    userId: string,
    permissions: string[],
    action: string,
  ): void {
    if (
      existing.createdById !== userId &&
      !permissions.includes(PERMISSIONS.SURVEY_MANAGE)
    ) {
      throw new ForbiddenException(
        `Only the creator or a survey manager can ${action} the survey`,
      );
    }
  }

  async close(id: string, userId: string, permissions: string[]) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, createdById: true, status: true },
    });
    if (!existing) throw new NotFoundException("Survey form not found");
    this.assertCanManageStatus(existing, userId, permissions, "close");
    if (existing.status !== "published") {
      throw new BadRequestException(`Cannot close a "${existing.status}" form`);
    }
    return prisma.survey.update({
      where: { id },
      data: { status: "closed", closedAt: new Date() },
      include: FORM_INCLUDES,
    });
  }

  // Re-open a closed survey so it accepts responses again. Does NOT touch the
  // schedule window — if `endDate` has already passed the form still reads as
  // expired in the dashboard/notification read-models; extend it via schedule.
  async reopen(id: string, userId: string, permissions: string[]) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, createdById: true, status: true, archivedAt: true },
    });
    if (!existing) throw new NotFoundException("Survey form not found");
    this.assertCanManageStatus(existing, userId, permissions, "reopen");
    if (existing.archivedAt) {
      throw new BadRequestException("Unarchive the survey before reopening it");
    }
    if (existing.status !== "closed") {
      throw new BadRequestException(
        `Cannot reopen a "${existing.status}" form`,
      );
    }
    return prisma.survey.update({
      where: { id },
      data: { status: "published", closedAt: null },
      include: FORM_INCLUDES,
    });
  }

  async archive(id: string, userId: string) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, createdById: true, archivedAt: true },
    });
    if (!existing) throw new NotFoundException("Survey form not found");
    if (existing.createdById !== userId) {
      throw new ForbiddenException("Only the creator can archive the survey");
    }
    if (existing.archivedAt) {
      throw new BadRequestException("Survey is already archived");
    }
    return prisma.survey.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: FORM_INCLUDES,
    });
  }

  async unarchive(id: string, userId: string) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, createdById: true, archivedAt: true },
    });
    if (!existing) throw new NotFoundException("Survey form not found");
    if (existing.createdById !== userId) {
      throw new ForbiddenException("Only the creator can restore the survey");
    }
    if (!existing.archivedAt) {
      throw new BadRequestException("Survey is not archived");
    }
    return prisma.survey.update({
      where: { id },
      data: { archivedAt: null },
      include: FORM_INCLUDES,
    });
  }

  async submitResponse(id: string, userId: string, input: SubmitResponseInput) {
    const form = await prisma.survey.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!form) throw new NotFoundException("Survey form not found");
    if (form.status !== "published") {
      throw new BadRequestException(
        `Cannot submit a response to a "${form.status}" form`,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, entityId: true, department: true },
    });
    if (!user) throw new ForbiddenException("Unknown user");
    if (!targetsUser(form, user)) {
      throw new ForbiddenException("You are not in this survey's audience");
    }

    if (!form.isAnonymous) {
      const existing = await prisma.surveyResponse.findUnique({
        where: {
          surveyId_respondentId: {
            surveyId: form.id,
            respondentId: userId,
          },
        },
      });
      if (existing) {
        throw new BadRequestException(
          "You have already responded to this survey",
        );
      }
    }

    // Validate every required question has an answer + that the
    // answer matches the question type.
    const answersByQuestion = new Map<string, unknown>();
    for (const a of input.answers) {
      answersByQuestion.set(a.questionId, a.value);
    }

    const validatedRows: Array<{ questionId: string; value: unknown }> = [];
    for (const q of form.questions) {
      const raw = answersByQuestion.get(q.id);
      const validated = validateAnswerValue(q.type, q.options, q.required, raw);
      if (validated !== null) {
        validatedRows.push({ questionId: q.id, value: validated });
      } else if (q.required) {
        throw new BadRequestException(`Question "${q.prompt}" is required`);
      }
    }

    const saved = await prisma.$transaction(async (tx) => {
      const response = await tx.surveyResponse.create({
        data: {
          surveyId: form.id,
          respondentId: form.isAnonymous ? null : userId,
        },
      });
      if (validatedRows.length > 0) {
        await tx.surveyAnswer.createMany({
          data: validatedRows.map((a) => ({
            responseId: response.id,
            questionId: a.questionId,
            value: a.value as never,
          })),
        });
      }
      return tx.surveyResponse.findUnique({
        where: { id: response.id },
        include: { answers: true },
      });
    });

    // Notify the form owner + Admin/HR of the new response. Best-effort:
    // a notification failure must never affect the submission result.
    void this.notifyFormSubmission(form, userId).catch((err) => {
      logger.error("Failed to send survey-form submission notification", {
        error: err,
        formId: form.id,
      });
    });

    return saved;
  }

  // Email the form owner + active Admins/HR Managers when an employee
  // submits a response (deduped; anonymous respondents shown as "Anonymous").
  // Requires the OneWave email template "survey-form-response-submitted".
  private async notifyFormSubmission(
    form: {
      id: string;
      title: string;
      createdById: string;
      isAnonymous: boolean;
    },
    respondentId: string,
  ) {
    // Admin-configured recipient list is authoritative when set: owner + list.
    // When empty, fall back to owner + Admin/HR roles (default behavior).
    const configured = (await this.getNotificationRecipients()).recipients;
    let emails: string[];
    if (configured.length > 0) {
      const owner = await prisma.user.findUnique({
        where: { id: form.createdById },
        select: { email: true },
      });
      emails = [...new Set([...(owner ? [owner.email] : []), ...configured])];
    } else {
      const recipients = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { id: form.createdById },
            {
              userRoles: {
                some: { role: { name: { in: ["Admin", "HR Manager", "HR"] } } },
              },
            },
          ],
        },
        select: { email: true },
      });
      emails = [...new Set(recipients.map((r) => r.email))];
    }
    if (emails.length === 0) return;

    let respondentName = "Anonymous";
    if (!form.isAnonymous) {
      const respondent = await prisma.user.findUnique({
        where: { id: respondentId },
        select: { name: true },
      });
      respondentName = respondent?.name ?? "An employee";
    }

    const responseCount = await prisma.surveyResponse.count({
      where: { surveyId: form.id },
    });

    const email = surveyFormSubmittedEmail({
      formTitle: form.title,
      respondentName,
      submittedAt: new Date().toISOString(),
      responseCount,
      portalUrl: `${PORTAL_URL}/survey/${form.id}`,
    });
    void sendEmail({ to: emails, ...email });
  }

  async getMyResponse(id: string, userId: string) {
    const form = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, isAnonymous: true },
    });
    if (!form) throw new NotFoundException("Survey form not found");
    if (form.isAnonymous) return null;
    return prisma.surveyResponse.findUnique({
      where: {
        surveyId_respondentId: {
          surveyId: id,
          respondentId: userId,
        },
      },
      include: { answers: true },
    });
  }

  async listResponses(id: string, userId: string, userPermissions: string[]) {
    const form = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, createdById: true, isAnonymous: true },
    });
    if (!form) throw new NotFoundException("Survey form not found");
    if (form.createdById !== userId && !canManage(userPermissions)) {
      throw new ForbiddenException("Only the creator can view responses");
    }
    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId: id },
      include: {
        respondent: form.isAnonymous
          ? false
          : { select: { id: true, name: true, email: true, department: true } },
        answers: true,
      },
      orderBy: { submittedAt: "desc" },
    });
    return responses;
  }

  async getAnalytics(id: string, userId: string, userPermissions: string[]) {
    const form = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: "asc" } },
        _count: { select: { responses: true } },
      },
    });
    if (!form) throw new NotFoundException("Survey form not found");
    if (form.createdById !== userId && !canManage(userPermissions)) {
      throw new ForbiddenException("Only the creator can view analytics");
    }

    const allAnswers = await prisma.surveyAnswer.findMany({
      where: { question: { surveyId: id } },
      select: { questionId: true, value: true },
    });
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
        const base = {
          id: q.id,
          prompt: q.prompt,
          type: q.type,
          responses: values.length,
        };

        if (q.type === "single_choice") {
          const counts: Record<string, number> = {};
          for (const v of values) {
            if (typeof v === "string") {
              counts[v] = (counts[v] ?? 0) + 1;
            }
          }
          return { ...base, kind: "choice" as const, counts };
        }
        if (q.type === "multi_choice") {
          const counts: Record<string, number> = {};
          for (const v of values) {
            if (Array.isArray(v)) {
              for (const item of v) {
                if (typeof item === "string") {
                  counts[item] = (counts[item] ?? 0) + 1;
                }
              }
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
        // text + date — surface raw values (truncated)
        const samples = values
          .filter((v): v is string => typeof v === "string")
          .slice(0, 50);
        return { ...base, kind: "text" as const, samples };
      });

    return {
      totalResponses: form._count.responses,
      questions: questionStats,
    };
  }

  private questionInputToCreate(q: SurveyQuestionInput, order: number) {
    return {
      order,
      type: q.type,
      prompt: q.prompt,
      helperText: q.helperText ?? null,
      required: q.required,
      options: q.options as never,
      settings: q.settings as never,
    };
  }
}

export const surveyService = new SurveyService();
