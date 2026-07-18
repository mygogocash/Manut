import {
  createSurveyEngineRoutes,
  type CreateSurveyStore,
} from "../survey-engine/routes";

export type { CreateSurveyStore };

export function createSurveyRoutes(options: {
  createSurveyStore?: CreateSurveyStore;
} = {}) {
  return createSurveyEngineRoutes({
    kind: "survey",
    apiPrefix: "/api/survey",
    config: {
      managePermission: "survey:manage",
      notFoundMessage: "Survey form not found.",
    },
    createSurveyStore: options.createSurveyStore,
  });
}
