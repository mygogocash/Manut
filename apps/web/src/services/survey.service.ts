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

export type SurveyStatus = "draft" | "published" | "closed";

export interface SurveyQuestion {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  helperText: string | null;
  required: boolean;
  options: string[];
  settings: Record<string, unknown>;
}

export interface SurveySummary {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
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

export interface SurveyDetail extends SurveySummary {
  questions: SurveyQuestion[];
}

export interface SurveyResponseRow {
  id: string;
  surveyId: string;
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

export interface SurveyAnalytics {
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

export interface CreateSurveyInput {
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

export interface UpdateSurveyInput {
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

export interface ListSurveysParams {
  page?: number;
  limit?: number;
  status?: SurveyStatus;
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

export async function listSurveys(
  params: ListSurveysParams = {},
): Promise<ApiPaginatedResponse<SurveySummary>> {
  return api.get(`/survey${buildQuery(params)}`);
}

export async function getSurvey(
  id: string,
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.get(`/survey/${id}`);
}

export async function createSurvey(
  input: CreateSurveyInput,
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.post("/survey", input);
}

export async function updateSurvey(
  id: string,
  input: UpdateSurveyInput,
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.put(`/survey/${id}`, input);
}

export async function deleteSurvey(id: string): Promise<void> {
  await api.delete(`/survey/${id}`);
}

export async function replaceSurveyQuestions(
  id: string,
  questions: QuestionInput[],
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.put(`/survey/${id}/questions`, { questions });
}

export interface SurveyAnnounceOptions {
  wall?: boolean;
  news?: boolean;
  companyDate?: boolean;
  message?: string;
  deadline?: string;
}

export async function publishSurvey(
  id: string,
  announce?: SurveyAnnounceOptions,
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.post(`/survey/${id}/publish`, announce ? { announce } : {});
}

// Re-broadcast an already-published form to the wall/news/dates on demand.
export async function announceSurvey(
  id: string,
  announce: SurveyAnnounceOptions,
): Promise<ApiSuccessResponse<{ posted: string[] }>> {
  return api.post(`/survey/${id}/announce`, { announce });
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
  return api.get("/survey/announcement-settings");
}

export async function updateAnnouncementSettings(
  input: AnnouncementDefaults,
): Promise<ApiSuccessResponse<AnnouncementDefaults>> {
  return api.put("/survey/announcement-settings", input);
}

export interface NotificationSettings {
  recipients: string[];
}

export async function getNotificationSettings(): Promise<
  ApiSuccessResponse<NotificationSettings>
> {
  return api.get("/survey/notification-settings");
}

export async function updateNotificationSettings(
  input: NotificationSettings,
): Promise<ApiSuccessResponse<NotificationSettings>> {
  return api.put("/survey/notification-settings", input);
}

export async function closeSurvey(
  id: string,
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.post(`/survey/${id}/close`, {});
}

// Re-open a closed survey (closed → published) so it accepts responses again.
export async function reopenSurvey(
  id: string,
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.post(`/survey/${id}/reopen`, {});
}

// Set or extend the open/close window (draft or published forms).
export async function scheduleSurvey(
  id: string,
  input: { startDate?: string | null; endDate?: string | null },
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.put(`/survey/${id}/schedule`, input);
}

export async function archiveSurvey(
  id: string,
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.post(`/survey/${id}/archive`, {});
}

export async function unarchiveSurvey(
  id: string,
): Promise<ApiSuccessResponse<SurveyDetail>> {
  return api.post(`/survey/${id}/unarchive`, {});
}

export async function submitSurveyResponse(
  id: string,
  answers: Array<{ questionId: string; value: unknown }>,
): Promise<ApiSuccessResponse<{ id: string }>> {
  return api.post(`/survey/${id}/responses`, { answers });
}

export async function getMySurveyResponse(id: string): Promise<
  ApiSuccessResponse<{
    id: string;
    answers: Array<{ questionId: string; value: unknown }>;
  } | null>
> {
  return api.get(`/survey/${id}/my-response`);
}

export async function listSurveyResponses(
  id: string,
): Promise<ApiSuccessResponse<SurveyResponseRow[]>> {
  return api.get(`/survey/${id}/responses`);
}

export async function getSurveyAnalytics(
  id: string,
): Promise<ApiSuccessResponse<SurveyAnalytics>> {
  return api.get(`/survey/${id}/analytics`);
}
