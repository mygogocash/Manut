import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export type QuestionType =
  | "info"
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multi_choice"
  | "rating"
  | "date"
  | "number";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  info: "Section / instructions",
  short_text: "Short answer",
  long_text: "Long answer",
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  rating: "Rating (1–5)",
  date: "Date",
  number: "Number",
};

export type SurveyFormStatus = "draft" | "published" | "closed";

export interface SurveyFormQuestion {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  helperText: string | null;
  required: boolean;
  options: string[];
  settings: Record<string, unknown>;
}

export interface SurveyFormSummary {
  id: string;
  title: string;
  description: string | null;
  status: SurveyFormStatus;
  isAnonymous: boolean;
  targetAll: boolean;
  targetEntityIds: string[];
  targetDepartments: string[];
  targetUserIds: string[];
  publishedAt: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string } | null;
  _count: { questions: number; responses: number };
  alreadyResponded?: boolean;
}

export interface SurveyFormDetail extends SurveyFormSummary {
  questions: SurveyFormQuestion[];
}

export interface SurveyFormResponseRow {
  id: string;
  surveyFormId: string;
  respondentId: string | null;
  submittedAt: string;
  respondent?: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  } | null;
  answers: Array<{
    id: string;
    questionId: string;
    value: unknown;
  }>;
}

export interface SurveyFormAnalytics {
  totalResponses: number;
  questions: Array<
    | {
        id: string;
        prompt: string;
        type: QuestionType;
        responses: number;
        kind: "choice";
        counts: Record<string, number>;
      }
    | {
        id: string;
        prompt: string;
        type: QuestionType;
        responses: number;
        kind: "numeric";
        average: number | null;
        min: number | null;
        max: number | null;
      }
    | {
        id: string;
        prompt: string;
        type: QuestionType;
        responses: number;
        kind: "text";
        samples: string[];
      }
  >;
}

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  helperText?: string | null;
  required: boolean;
  options: string[];
  settings: Record<string, unknown>;
}

export interface CreateSurveyFormInput {
  title: string;
  description?: string | null;
  isAnonymous: boolean;
  targetAll: boolean;
  targetEntityIds: string[];
  targetDepartments: string[];
  targetUserIds: string[];
  questions: QuestionInput[];
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateSurveyFormInput {
  title?: string;
  description?: string | null;
  isAnonymous?: boolean;
  targetAll?: boolean;
  targetEntityIds?: string[];
  targetDepartments?: string[];
  targetUserIds?: string[];
  startDate?: string | null;
  endDate?: string | null;
}

export interface ListSurveyFormsParams {
  page?: number;
  limit?: number;
  status?: SurveyFormStatus;
  scope?: "mine" | "all" | "available";
  archived?: boolean;
}

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function listSurveyForms(
  params: ListSurveyFormsParams = {},
): Promise<ApiPaginatedResponse<SurveyFormSummary>> {
  return api.get(`/survey-forms${buildQuery(params)}`);
}

export async function getSurveyForm(
  id: string,
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.get(`/survey-forms/${id}`);
}

export async function createSurveyForm(
  input: CreateSurveyFormInput,
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.post("/survey-forms", input);
}

export async function updateSurveyForm(
  id: string,
  input: UpdateSurveyFormInput,
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.put(`/survey-forms/${id}`, input);
}

export async function deleteSurveyForm(id: string): Promise<void> {
  await api.delete(`/survey-forms/${id}`);
}

export async function replaceSurveyFormQuestions(
  id: string,
  questions: QuestionInput[],
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.put(`/survey-forms/${id}/questions`, { questions });
}

export interface SurveyAnnounceOptions {
  wall?: boolean;
  news?: boolean;
  companyDate?: boolean;
  message?: string;
  deadline?: string;
}

export async function publishSurveyForm(
  id: string,
  announce?: SurveyAnnounceOptions,
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.post(`/survey-forms/${id}/publish`, announce ? { announce } : {});
}

// Re-broadcast an already-published form to the wall/news/dates on demand.
export async function announceSurveyForm(
  id: string,
  announce: SurveyAnnounceOptions,
): Promise<ApiSuccessResponse<{ posted: string[] }>> {
  return api.post(`/survey-forms/${id}/announce`, { announce });
}

export interface AnnouncementDefaults {
  wall: boolean;
  news: boolean;
  companyDate: boolean;
  messageTemplate: string;
  newsCategory: string;
}

export async function getAnnouncementSettings(): Promise<
  ApiSuccessResponse<AnnouncementDefaults>
> {
  return api.get("/survey-forms/announcement-settings");
}

export async function updateAnnouncementSettings(
  input: AnnouncementDefaults,
): Promise<ApiSuccessResponse<AnnouncementDefaults>> {
  return api.put("/survey-forms/announcement-settings", input);
}

export interface NotificationSettings {
  recipients: string[];
}

export async function getNotificationSettings(): Promise<
  ApiSuccessResponse<NotificationSettings>
> {
  return api.get("/survey-forms/notification-settings");
}

export async function updateNotificationSettings(
  input: NotificationSettings,
): Promise<ApiSuccessResponse<NotificationSettings>> {
  return api.put("/survey-forms/notification-settings", input);
}

export async function closeSurveyForm(
  id: string,
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.post(`/survey-forms/${id}/close`, {});
}

// Re-open a closed survey (closed → published) so it accepts responses again.
export async function reopenSurveyForm(
  id: string,
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.post(`/survey-forms/${id}/reopen`, {});
}

// Set or extend the open/close window (draft or published forms).
export async function scheduleSurveyForm(
  id: string,
  input: { startDate?: string | null; endDate?: string | null },
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.put(`/survey-forms/${id}/schedule`, input);
}

export async function archiveSurveyForm(
  id: string,
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.post(`/survey-forms/${id}/archive`, {});
}

export async function unarchiveSurveyForm(
  id: string,
): Promise<ApiSuccessResponse<SurveyFormDetail>> {
  return api.post(`/survey-forms/${id}/unarchive`, {});
}

export async function submitSurveyResponse(
  id: string,
  answers: Array<{ questionId: string; value: unknown }>,
): Promise<ApiSuccessResponse<{ id: string }>> {
  return api.post(`/survey-forms/${id}/responses`, { answers });
}

export async function getMySurveyResponse(id: string): Promise<
  ApiSuccessResponse<{
    id: string;
    answers: Array<{ questionId: string; value: unknown }>;
  } | null>
> {
  return api.get(`/survey-forms/${id}/my-response`);
}

export async function listSurveyFormResponses(
  id: string,
): Promise<ApiSuccessResponse<SurveyFormResponseRow[]>> {
  return api.get(`/survey-forms/${id}/responses`);
}

export async function getSurveyFormAnalytics(
  id: string,
): Promise<ApiSuccessResponse<SurveyFormAnalytics>> {
  return api.get(`/survey-forms/${id}/analytics`);
}
