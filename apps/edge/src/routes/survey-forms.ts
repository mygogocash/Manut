import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  announcementSettingsSchema,
  createSurveyFormSchema,
  listSurveyFormsSchema,
  notificationSettingsSchema,
  publishSurveyFormSchema,
  replaceQuestionsSchema,
  scheduleSurveyFormSchema,
  submitResponseSchema,
  updateSurveyFormSchema,
} from "@nexora/contracts/modules/survey-forms/survey-forms.validation";
import { surveyFormsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

export const surveyForms = new Hono<AppEnv>()
  .get("/", requireAuth, zValidator("query", listSurveyFormsSchema), async (c) =>
    c.json(await surveyFormsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), zValidator("json", createSurveyFormSchema), async (c) => {
    const data = await surveyFormsService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/announcement-settings", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), async (c) =>
    c.json({ data: await surveyFormsService.getAnnouncementDefaults(c.var.db) }),
  )
  .put(
    "/announcement-settings",
    requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
    zValidator("json", announcementSettingsSchema),
    async (c) => c.json({ data: await surveyFormsService.setAnnouncementDefaults(c.var.db, c.req.valid("json")) }),
  )
  .get("/notification-settings", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), async (c) =>
    c.json({ data: await surveyFormsService.getNotificationRecipients(c.var.db) }),
  )
  .put(
    "/notification-settings",
    requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
    zValidator("json", notificationSettingsSchema),
    async (c) => c.json({ data: await surveyFormsService.setNotificationRecipients(c.var.db, c.req.valid("json")) }),
  )
  .get("/:id", requireAuth, async (c) =>
    c.json({
      data: await surveyFormsService.getById(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .put("/:id", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), zValidator("json", updateSurveyFormSchema), async (c) =>
    c.json({ data: await surveyFormsService.update(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json")) }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), async (c) => {
    await surveyFormsService.remove(c.var.db, c.req.param("id"), c.var.user!.id);
    return c.json({ data: { success: true } });
  })
  .put(
    "/:id/questions",
    requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
    zValidator("json", replaceQuestionsSchema),
    async (c) =>
      c.json({ data: await surveyFormsService.replaceQuestions(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json")) }),
  )
  .post(
    "/:id/publish",
    requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
    zValidator("json", publishSurveyFormSchema),
    async (c) => {
      const body = c.req.valid("json");
      const data = await surveyFormsService.publish(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
        body.announce,
      );
      return c.json({ data });
    },
  )
  .post(
    "/:id/announce",
    requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
    zValidator("json", publishSurveyFormSchema),
    async (c) => {
      const body = c.req.valid("json");
      const data = await surveyFormsService.announceNow(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
        body.announce ?? { wall: false, news: false, companyDate: false },
      );
      return c.json({ data });
    },
  )
  .put(
    "/:id/schedule",
    requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
    zValidator("json", scheduleSurveyFormSchema),
    async (c) =>
      c.json({ data: await surveyFormsService.setSchedule(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json")) }),
  )
  .post("/:id/close", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), async (c) =>
    c.json({
      data: await surveyFormsService.close(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .post("/:id/reopen", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), async (c) =>
    c.json({
      data: await surveyFormsService.reopen(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .post("/:id/archive", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), async (c) =>
    c.json({ data: await surveyFormsService.archive(c.var.db, c.req.param("id"), c.var.user!.id) }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), async (c) =>
    c.json({ data: await surveyFormsService.unarchive(c.var.db, c.req.param("id"), c.var.user!.id) }),
  )
  .post("/:id/responses", requireAuth, zValidator("json", submitResponseSchema), async (c) => {
    const data = await surveyFormsService.submitResponse(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/:id/my-response", requireAuth, async (c) =>
    c.json({ data: await surveyFormsService.getMyResponse(c.var.db, c.req.param("id"), c.var.user!.id) }),
  )
  .get("/:id/responses", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), async (c) =>
    c.json({
      data: await surveyFormsService.listResponses(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .get("/:id/analytics", requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE), async (c) =>
    c.json({
      data: await surveyFormsService.getAnalytics(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  );
