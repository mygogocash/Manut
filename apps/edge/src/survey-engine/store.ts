export type SurveyKind = "survey" | "survey-form";

export interface SurveyQuestionRecord {
  id: string;
  order: number;
  type: string;
  prompt: string;
  helperText: string | null;
  required: boolean;
  options: unknown;
  settings: unknown;
}

export interface SurveyFormRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  isAnonymous: boolean;
  targetAll: boolean;
  targetEntityIds: unknown;
  targetDepartments: unknown;
  targetUserIds: unknown;
  publishedAt: string | Date | null;
  closedAt: string | Date | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  archivedAt: string | Date | null;
  createdById: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  questions: SurveyQuestionRecord[];
  questionCount: number;
  responseCount: number;
}

export interface SurveyAudienceUser {
  id: string;
  entityId: string | null;
  department: string | null;
}

export interface SurveyResponseRecord {
  id: string;
  formId: string;
  respondentId: string | null;
  submittedAt: string | Date;
  answers: Array<{ questionId: string; value: unknown }>;
}

export interface ListSurveyFilters {
  status?: string;
  scope: "available" | "mine" | "all";
  archived: boolean;
  createdById?: string;
}

export interface CreateSurveyStoreInput {
  title: string;
  description: string | null;
  isAnonymous: boolean;
  targetAll: boolean;
  targetEntityIds: string[];
  targetDepartments: string[];
  targetUserIds: string[];
  createdById: string;
}

export interface QuestionInput {
  type: string;
  prompt: string;
  helperText: string | null;
  required: boolean;
  options: string[];
  settings: Record<string, unknown>;
}

export interface SurveyStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findAudienceUser(userId: string): Promise<SurveyAudienceUser | null>;
  findMany(
    filters: ListSurveyFilters,
    page: number,
    limit: number,
  ): Promise<{ data: SurveyFormRecord[]; total: number }>;
  findRespondedFormIds(
    formIds: string[],
    userId: string,
  ): Promise<Set<string>>;
  findById(id: string): Promise<SurveyFormRecord | null>;
  create(input: CreateSurveyStoreInput): Promise<SurveyFormRecord>;
  replaceQuestions(
    id: string,
    questions: QuestionInput[],
  ): Promise<SurveyFormRecord | null>;
  publish(id: string): Promise<SurveyFormRecord | null>;
  findMyResponse(
    formId: string,
    userId: string,
  ): Promise<SurveyResponseRecord | null>;
  createResponse(input: {
    formId: string;
    respondentId: string | null;
    answers: Array<{ questionId: string; value: unknown }>;
  }): Promise<SurveyResponseRecord>;
  hasResponse(formId: string, userId: string): Promise<boolean>;
}
