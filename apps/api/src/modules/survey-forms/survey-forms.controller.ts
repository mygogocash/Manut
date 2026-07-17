import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  ensurePermissionsLoaded,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { surveyFormsService } from "@/modules/survey-forms/survey-forms.service";
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
} from "@/modules/survey-forms/survey-forms.validation";

const router = Router();

router.use(authenticate, requireActive);

// Anyone can browse the catalogue — `available` scope filters to the
// active user's audience, `mine` to forms they created. Only HR /
// admins (`survey:manage-wave`) get the `all` scope.
//
// `ensurePermissionsLoaded` is REQUIRED here (#524 audit): the route
// doesn't gate on a static permission (everyone can list), but the
// service uses `canManage(perms)` to decide whether the caller can
// see the `all` scope. Without this call, an HR user holding
// `survey:manage-wave` was silently scoped to "available + mine"
// because `authenticate` ships `permissions: []` and only
// `requirePermission` populates it as a side effect. Same shape as
// expenses approve/reject + travel approve/reject (now #530).
router.get(
  "/",
  asyncHandler(async (req, res) => {
    await ensurePermissionsLoaded(req);
    const query = listSurveyFormsSchema.parse(req.query);
    const result = await surveyFormsService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const input = createSurveyFormSchema.parse(req.body);
    const data = await surveyFormsService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

// Literal routes must precede "/:id" — Express matches in order.
router.get(
  "/announcement-settings",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (_req, res) => {
    const data = await surveyFormsService.getAnnouncementDefaults();
    res.json({ data });
  }),
);

router.put(
  "/announcement-settings",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const input = announcementSettingsSchema.parse(req.body);
    const data = await surveyFormsService.setAnnouncementDefaults(input);
    res.json({ data });
  }),
);

router.get(
  "/notification-settings",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (_req, res) => {
    const data = await surveyFormsService.getNotificationRecipients();
    res.json({ data });
  }),
);

router.put(
  "/notification-settings",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const input = notificationSettingsSchema.parse(req.body);
    const data = await surveyFormsService.setNotificationRecipients(input);
    res.json({ data });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await ensurePermissionsLoaded(req);
    const id = getRequiredParam(req.params, "id");
    const data = await surveyFormsService.getById(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateSurveyFormSchema.parse(req.body);
    const data = await surveyFormsService.update(id, req.user!.id, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await surveyFormsService.delete(id, req.user!.id);
    res.json({ data: { success: true } });
  }),
);

router.put(
  "/:id/questions",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = replaceQuestionsSchema.parse(req.body);
    const data = await surveyFormsService.replaceQuestions(
      id,
      req.user!.id,
      input,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/publish",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = publishSurveyFormSchema.parse(req.body ?? {});
    const data = await surveyFormsService.publish(
      id,
      req.user!.id,
      req.user!.permissions,
      input.announce,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/announce",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = publishSurveyFormSchema.parse(req.body ?? {});
    const data = await surveyFormsService.announceNow(
      id,
      req.user!.id,
      req.user!.permissions,
      input.announce ?? { wall: false, news: false, companyDate: false },
    );
    res.json({ data });
  }),
);

router.put(
  "/:id/schedule",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = scheduleSurveyFormSchema.parse(req.body);
    const data = await surveyFormsService.setSchedule(id, req.user!.id, input);
    res.json({ data });
  }),
);

router.post(
  "/:id/close",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await surveyFormsService.close(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/reopen",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await surveyFormsService.reopen(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/archive",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await surveyFormsService.archive(id, req.user!.id);
    res.json({ data });
  }),
);

router.post(
  "/:id/unarchive",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await surveyFormsService.unarchive(id, req.user!.id);
    res.json({ data });
  }),
);

router.post(
  "/:id/responses",
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = submitResponseSchema.parse(req.body);
    const data = await surveyFormsService.submitResponse(
      id,
      req.user!.id,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id/my-response",
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await surveyFormsService.getMyResponse(id, req.user!.id);
    res.json({ data });
  }),
);

router.get(
  "/:id/responses",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await surveyFormsService.listResponses(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.get(
  "/:id/analytics",
  requirePermission(PERMISSIONS.SURVEY_MANAGE_WAVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await surveyFormsService.getAnalytics(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

export default router;
