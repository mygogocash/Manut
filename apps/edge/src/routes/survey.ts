import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  announcementSettingsSchema,
  createSurveySchema,
  listSurveysSchema,
  notificationSettingsSchema,
  publishSurveySchema,
  replaceQuestionsSchema,
  scheduleSurveySchema,
  submitResponseSchema,
  updateSurveySchema,
} from "@nexora/contracts/modules/survey/survey.validation";
import { surveyService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

export const survey = new Hono<AppEnv>()
  .get("/", requireAuth, zValidator("query", listSurveysSchema), async (c) =>
    c.json(await surveyService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.SURVEY_MANAGE), zValidator("json", createSurveySchema), async (c) => {
    const data = await surveyService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/announcement-settings", requirePermission(PERMISSIONS.SURVEY_MANAGE), async (c) =>
    c.json({ data: await surveyService.getAnnouncementDefaults(c.var.db) }),
  )
  .put(
    "/announcement-settings",
    requirePermission(PERMISSIONS.SURVEY_MANAGE),
    zValidator("json", announcementSettingsSchema),
    async (c) => c.json({ data: await surveyService.setAnnouncementDefaults(c.var.db, c.req.valid("json")) }),
  )
  .get("/notification-settings", requirePermission(PERMISSIONS.SURVEY_MANAGE), async (c) =>
    c.json({ data: await surveyService.getNotificationRecipients(c.var.db) }),
  )
  .put(
    "/notification-settings",
    requirePermission(PERMISSIONS.SURVEY_MANAGE),
    zValidator("json", notificationSettingsSchema),
    async (c) => c.json({ data: await surveyService.setNotificationRecipients(c.var.db, c.req.valid("json")) }),
  )
  .get("/:id", requireAuth, async (c) =>
    c.json({
      data: await surveyService.getById(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .put("/:id", requirePermission(PERMISSIONS.SURVEY_MANAGE), zValidator("json", updateSurveySchema), async (c) =>
    c.json({ data: await surveyService.update(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json")) }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.SURVEY_MANAGE), async (c) => {
    await surveyService.remove(c.var.db, c.req.param("id"), c.var.user!.id);
    return c.json({ data: { success: true } });
  })
  .put(
    "/:id/questions",
    requirePermission(PERMISSIONS.SURVEY_MANAGE),
    zValidator("json", replaceQuestionsSchema),
    async (c) =>
      c.json({ data: await surveyService.replaceQuestions(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json")) }),
  )
  .post(
    "/:id/publish",
    requirePermission(PERMISSIONS.SURVEY_MANAGE),
    zValidator("json", publishSurveySchema),
    async (c) => {
      const body = c.req.valid("json");
      const data = await surveyService.publish(
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
    requirePermission(PERMISSIONS.SURVEY_MANAGE),
    zValidator("json", publishSurveySchema),
    async (c) => {
      const body = c.req.valid("json");
      const data = await surveyService.announceNow(
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
    requirePermission(PERMISSIONS.SURVEY_MANAGE),
    zValidator("json", scheduleSurveySchema),
    async (c) =>
      c.json({ data: await surveyService.setSchedule(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json")) }),
  )
  .post("/:id/close", requirePermission(PERMISSIONS.SURVEY_MANAGE), async (c) =>
    c.json({
      data: await surveyService.close(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .post("/:id/reopen", requirePermission(PERMISSIONS.SURVEY_MANAGE), async (c) =>
    c.json({
      data: await surveyService.reopen(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .post("/:id/archive", requirePermission(PERMISSIONS.SURVEY_MANAGE), async (c) =>
    c.json({ data: await surveyService.archive(c.var.db, c.req.param("id"), c.var.user!.id) }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.SURVEY_MANAGE), async (c) =>
    c.json({ data: await surveyService.unarchive(c.var.db, c.req.param("id"), c.var.user!.id) }),
  )
  .post("/:id/responses", requireAuth, zValidator("json", submitResponseSchema), async (c) => {
    const data = await surveyService.submitResponse(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/:id/my-response", requireAuth, async (c) =>
    c.json({ data: await surveyService.getMyResponse(c.var.db, c.req.param("id"), c.var.user!.id) }),
  )
  .get("/:id/responses", requirePermission(PERMISSIONS.SURVEY_MANAGE), async (c) =>
    c.json({
      data: await surveyService.listResponses(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .get("/:id/analytics", requirePermission(PERMISSIONS.SURVEY_MANAGE), async (c) =>
    c.json({
      data: await surveyService.getAnalytics(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  );
