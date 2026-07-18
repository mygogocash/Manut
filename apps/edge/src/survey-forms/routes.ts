import {
  createSurveyEngineRoutes,
  type CreateSurveyStore,
} from "../survey-engine/routes";

export type { CreateSurveyStore as CreateSurveyFormsStore };

export function createSurveyFormsRoutes(options: {
  createSurveyStore?: CreateSurveyStore;
} = {}) {
  return createSurveyEngineRoutes({
    kind: "survey-form",
    apiPrefix: "/api/survey-forms",
    config: {
      managePermission: "survey:manage-wave",
      notFoundMessage: "Survey form not found.",
    },
    createSurveyStore: options.createSurveyStore,
  });
}
