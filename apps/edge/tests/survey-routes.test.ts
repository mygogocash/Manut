import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import type { RuntimeBindings } from "../src/runtime";
import type {
  SurveyFormRecord,
  SurveyStore,
} from "../src/survey-engine/store";

const TEST_TOKEN = "test-token-that-is-long-enough-for-edge-auth";
const FORM_ID = "11111111-1111-4111-8111-111111111111";
const QUESTION_ID = "22222222-2222-4222-8222-222222222222";

function testEnv(overrides: Partial<RuntimeBindings> = {}): RuntimeBindings {
  return {
    API_ORIGIN: "https://api.example",
    API_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    ENABLE_HYPERDRIVE_BOUNDARY: "false",
    ...overrides,
  } as RuntimeBindings;
}

function hyperdriveEnv(
  overrides: Partial<RuntimeBindings> = {},
): RuntimeBindings {
  return testEnv({
    ENABLE_HYPERDRIVE_BOUNDARY: "true",
    HYPERDRIVE_DATABASE: {
      connectionString: "postgresql://edge:local@127.0.0.1:5432/manut",
    } as Hyperdrive,
    ...overrides,
  });
}

const verifyToken = vi.fn(async () => ({
  role: "employee",
  subject: "user-123",
}));

function draftForm(overrides: Partial<SurveyFormRecord> = {}): SurveyFormRecord {
  return {
    id: FORM_ID,
    title: "Pulse",
    description: null,
    status: "draft",
    isAnonymous: false,
    targetAll: true,
    targetEntityIds: [],
    targetDepartments: [],
    targetUserIds: [],
    publishedAt: null,
    closedAt: null,
    startDate: null,
    endDate: null,
    archivedAt: null,
    createdById: "user-123",
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    questions: [],
    questionCount: 0,
    responseCount: 0,
    ...overrides,
  };
}

function memorySurveyStore(seed?: {
  forms?: SurveyFormRecord[];
  permissionsByUser?: Record<string, string[]>;
  respondedFormIds?: string[];
}): SurveyStore {
  const forms = [...(seed?.forms ?? [])];
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["survey:manage"],
  };
  const responded = new Set(seed?.respondedFormIds ?? []);
  const responses: Array<{
    id: string;
    formId: string;
    respondentId: string | null;
    answers: Array<{ questionId: string; value: unknown }>;
  }> = [];

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async findAudienceUser(userId) {
      return { id: userId, entityId: "entity-1", department: "Eng" };
    },
    async findMany(filters, page, limit) {
      let rows = [...forms];
      if (filters.archived) {
        rows = rows.filter((form) => form.archivedAt != null);
      } else {
        rows = rows.filter((form) => form.archivedAt == null);
      }
      if (filters.scope === "mine" && filters.createdById) {
        rows = rows.filter((form) => form.createdById === filters.createdById);
      } else if (filters.scope === "available") {
        rows = rows.filter((form) => form.status === "published");
      }
      if (filters.status) {
        rows = rows.filter((form) => form.status === filters.status);
      }
      const total = rows.length;
      const start = (page - 1) * limit;
      return { data: rows.slice(start, start + limit), total };
    },
    async findRespondedFormIds(formIds) {
      return new Set(formIds.filter((id) => responded.has(id)));
    },
    async findById(id) {
      return forms.find((form) => form.id === id) ?? null;
    },
    async create(input) {
      const row = draftForm({
        id: `33333333-3333-4333-8333-${String(forms.length).padStart(12, "0")}`,
        title: input.title,
        description: input.description,
        isAnonymous: input.isAnonymous,
        createdById: input.createdById,
      });
      forms.push(row);
      return row;
    },
    async replaceQuestions(id, questions) {
      const index = forms.findIndex((form) => form.id === id);
      if (index < 0) return null;
      const mapped = questions.map((question, order) => ({
        id: QUESTION_ID,
        order: order + 1,
        type: question.type,
        prompt: question.prompt,
        helperText: question.helperText,
        required: question.required,
        options: question.options,
        settings: question.settings,
      }));
      const next = {
        ...forms[index]!,
        questions: mapped,
        questionCount: mapped.length,
      };
      forms[index] = next;
      return next;
    },
    async publish(id) {
      const index = forms.findIndex((form) => form.id === id);
      if (index < 0) return null;
      const next = {
        ...forms[index]!,
        status: "published",
        publishedAt: "2026-07-18T12:00:00.000Z",
      };
      forms[index] = next;
      return next;
    },
    async findMyResponse(formId, userId) {
      const row = responses.find(
        (response) =>
          response.formId === formId && response.respondentId === userId,
      );
      if (!row) return null;
      return {
        id: row.id,
        formId: row.formId,
        respondentId: row.respondentId,
        submittedAt: "2026-07-18T12:00:00.000Z",
        answers: row.answers,
      };
    },
    async hasResponse(formId, userId) {
      return responses.some(
        (response) =>
          response.formId === formId && response.respondentId === userId,
      );
    },
    async createResponse(input) {
      const row = {
        id: `resp-${responses.length + 1}`,
        formId: input.formId,
        respondentId: input.respondentId,
        answers: input.answers,
      };
      responses.push(row);
      const formIndex = forms.findIndex((form) => form.id === input.formId);
      if (formIndex >= 0) {
        const current = forms[formIndex]!;
        forms[formIndex] = {
          ...current,
          responseCount: current.responseCount + 1,
        };
      }
      return {
        ...row,
        submittedAt: "2026-07-18T12:00:00.000Z",
      };
    },
    async setSchedule(id, input) {
      const index = forms.findIndex((form) => form.id === id);
      if (index < 0) return null;
      const next = {
        ...forms[index]!,
        startDate: input.startDate,
        endDate: input.endDate,
      };
      forms[index] = next;
      return next;
    },
    async close(id) {
      const index = forms.findIndex((form) => form.id === id);
      if (index < 0) return null;
      const next = {
        ...forms[index]!,
        status: "closed",
        closedAt: "2026-07-18T15:00:00.000Z",
      };
      forms[index] = next;
      return next;
    },
    async reopen(id) {
      const index = forms.findIndex((form) => form.id === id);
      if (index < 0) return null;
      const next = {
        ...forms[index]!,
        status: "published",
        closedAt: null,
      };
      forms[index] = next;
      return next;
    },
    async archive(id) {
      const index = forms.findIndex((form) => form.id === id);
      if (index < 0) return null;
      const next = {
        ...forms[index]!,
        archivedAt: "2026-07-18T16:00:00.000Z",
      };
      forms[index] = next;
      return next;
    },
    async unarchive(id) {
      const index = forms.findIndex((form) => form.id === id);
      if (index < 0) return null;
      const next = {
        ...forms[index]!,
        archivedAt: null,
      };
      forms[index] = next;
      return next;
    },
    async listResponses(formId) {
      return responses
        .filter((response) => response.formId === formId)
        .map((response) => ({
          id: response.id,
          formId: response.formId,
          respondentId: response.respondentId,
          respondentName:
            response.respondentId === null ? null : "Test User",
          respondentDepartment:
            response.respondentId === null ? null : "Eng",
          submittedAt: "2026-07-18T12:00:00.000Z",
          answers: response.answers,
        }));
    },
    async listAnswerValues(formId) {
      return responses
        .filter((response) => response.formId === formId)
        .flatMap((response) =>
          response.answers.map((answer) => ({
            questionId: answer.questionId,
            value: answer.value,
          })),
        );
    },
    async getAnnouncementDefaults() {
      return {
        wall: true,
        news: true,
        companyDate: true,
        messageTemplate:
          'New survey: "{title}" is now open. Share your input on the Intranet.',
        newsCategory: "Survey",
      };
    },
    async setAnnouncementDefaults(input) {
      return {
        wall: input.wall,
        news: input.news,
        companyDate: input.companyDate,
        messageTemplate: input.messageTemplate,
        newsCategory: input.newsCategory,
      };
    },
    async getNotificationRecipients() {
      return { recipients: [] };
    },
    async setNotificationRecipients(input) {
      return { recipients: input.recipients };
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("survey dual-path routes", () => {
  it("proxies /api/survey when Hyperdrive boundary is off", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/survey");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/survey",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed for survey when Hyperdrive is flagged on without a binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/survey",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("lists available surveys on the Hyperdrive path", async () => {
    const store = memorySurveyStore({
      permissionsByUser: { "user-123": [] },
      forms: [
        draftForm({
          status: "published",
          publishedAt: "2026-07-01T00:00:00.000Z",
          questionCount: 1,
          questions: [
            {
              id: QUESTION_ID,
              order: 1,
              type: "short_text",
              prompt: "How are you?",
              helperText: null,
              required: true,
              options: [],
              settings: {},
            },
          ],
        }),
        draftForm({
          id: "44444444-4444-4444-8444-444444444444",
          title: "Draft only",
          status: "draft",
        }),
      ],
    });

    const app = createEdgeApp({
      createSurveyStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/survey?page=1&limit=20",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<Record<string, unknown>>;
      meta: { total: number };
    };
    expect(body.meta.total).toBe(1);
    expect(body.data[0]).toMatchObject({
      id: FORM_ID,
      title: "Pulse",
      alreadyResponded: false,
    });
    expect(body.data[0]).not.toHaveProperty("createdBy");
    expect(body.data[0]).not.toHaveProperty("targetUserIds");
  });

  it("creates, replaces questions, and publishes on Hyperdrive", async () => {
    const store = memorySurveyStore();
    const app = createEdgeApp({
      createSurveyStore: async () => store,
      verifyToken,
    });

    const createResponse = await app.request(
      "https://intranet.example/api/survey",
      {
        body: JSON.stringify({ title: "New survey", isAnonymous: false }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      data: { id: string };
    };

    const questionsResponse = await app.request(
      `https://intranet.example/api/survey/${created.data.id}/questions`,
      {
        body: JSON.stringify({
          questions: [
            {
              type: "short_text",
              prompt: "Feedback?",
              required: true,
              options: [],
              settings: {},
            },
          ],
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
      },
      hyperdriveEnv(),
    );
    expect(questionsResponse.status).toBe(200);

    const publishResponse = await app.request(
      `https://intranet.example/api/survey/${created.data.id}/publish`,
      {
        body: JSON.stringify({}),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(publishResponse.status).toBe(200);
    await expect(publishResponse.json()).resolves.toMatchObject({
      data: { status: "published" },
    });
  });

  it("submits a response and returns my-response on Hyperdrive", async () => {
    const store = memorySurveyStore({
      permissionsByUser: { "user-123": [] },
      forms: [
        draftForm({
          status: "published",
          publishedAt: "2026-07-01T00:00:00.000Z",
          questionCount: 1,
          questions: [
            {
              id: QUESTION_ID,
              order: 1,
              type: "short_text",
              prompt: "How are you?",
              helperText: null,
              required: true,
              options: [],
              settings: {},
            },
          ],
        }),
      ],
    });

    const app = createEdgeApp({
      createSurveyStore: async () => store,
      verifyToken,
    });

    const submit = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/responses`,
      {
        body: JSON.stringify({
          answers: [{ questionId: QUESTION_ID, value: "Great" }],
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(submit.status).toBe(201);

    const mine = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/my-response`,
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(mine.status).toBe(200);
    await expect(mine.json()).resolves.toMatchObject({
      data: {
        answers: [{ questionId: QUESTION_ID, value: "Great" }],
      },
    });
  });

  it("schedules, closes, reopens, archives, and unarchives on Hyperdrive", async () => {
    const store = memorySurveyStore({
      forms: [
        draftForm({
          status: "published",
          publishedAt: "2026-07-01T00:00:00.000Z",
          questionCount: 1,
          questions: [
            {
              id: QUESTION_ID,
              order: 1,
              type: "short_text",
              prompt: "How are you?",
              helperText: null,
              required: true,
              options: [],
              settings: {},
            },
          ],
        }),
      ],
    });
    const app = createEdgeApp({
      createSurveyStore: async () => store,
      verifyToken,
    });

    const schedule = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/schedule`,
      {
        body: JSON.stringify({
          startDate: "2026-08-01",
          endDate: "2026-08-31",
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
      },
      hyperdriveEnv(),
    );
    expect(schedule.status).toBe(200);
    await expect(schedule.json()).resolves.toMatchObject({
      data: { startDate: "2026-08-01", endDate: "2026-08-31" },
    });

    const close = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/close`,
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(close.status).toBe(200);
    await expect(close.json()).resolves.toMatchObject({
      data: { status: "closed" },
    });

    const reopen = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/reopen`,
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(reopen.status).toBe(200);
    await expect(reopen.json()).resolves.toMatchObject({
      data: { status: "published", closedAt: null },
    });

    const archive = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/archive`,
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(archive.status).toBe(200);

    const unarchive = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/unarchive`,
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(unarchive.status).toBe(200);
    await expect(unarchive.json()).resolves.toMatchObject({
      data: { id: FORM_ID },
    });
  });

  it("lists responses and analytics on Hyperdrive without respondent emails", async () => {
    const store = memorySurveyStore({
      forms: [
        draftForm({
          status: "published",
          publishedAt: "2026-07-01T00:00:00.000Z",
          questionCount: 1,
          questions: [
            {
              id: QUESTION_ID,
              order: 1,
              type: "single_choice",
              prompt: "Pick one",
              helperText: null,
              required: true,
              options: ["A", "B"],
              settings: {},
            },
          ],
        }),
      ],
    });
    await store.createResponse({
      formId: FORM_ID,
      respondentId: "user-999",
      answers: [{ questionId: QUESTION_ID, value: "A" }],
    });

    const app = createEdgeApp({
      createSurveyStore: async () => store,
      verifyToken,
    });

    const responses = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/responses`,
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(responses.status).toBe(200);
    const responseBody = (await responses.json()) as {
      data: Array<Record<string, unknown>>;
    };
    expect(responseBody.data).toHaveLength(1);
    expect(responseBody.data[0]).toMatchObject({
      answers: [{ questionId: QUESTION_ID, value: "A" }],
      respondent: { id: "user-999", name: "Test User", department: "Eng" },
    });
    expect(responseBody.data[0]).not.toHaveProperty("respondent.email");
    expect(JSON.stringify(responseBody)).not.toContain("@");

    const analytics = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/analytics`,
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(analytics.status).toBe(200);
    await expect(analytics.json()).resolves.toMatchObject({
      data: {
        totalResponses: 1,
        questions: [
          {
            id: QUESTION_ID,
            kind: "choice",
            counts: { A: 1 },
          },
        ],
      },
    });
  });

  it("reads and writes announcement settings on Hyperdrive", async () => {
    const app = createEdgeApp({
      createSurveyStore: async () => memorySurveyStore(),
      verifyToken,
    });

    const get = await app.request(
      "https://intranet.example/api/survey/announcement-settings",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toMatchObject({
      data: { wall: true, newsCategory: "Survey" },
    });

    const put = await app.request(
      "https://intranet.example/api/survey/announcement-settings",
      {
        body: JSON.stringify({
          wall: false,
          news: true,
          companyDate: false,
          messageTemplate: "Hello {title}",
          newsCategory: "Pulse",
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
      },
      hyperdriveEnv(),
    );
    expect(put.status).toBe(200);
    await expect(put.json()).resolves.toMatchObject({
      data: { wall: false, newsCategory: "Pulse" },
    });
  });

  it("proxies announce side-effects (wall/news/companyDate) to Express", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe(
        `/api/survey/${FORM_ID}/announce`,
      );
      return Response.json({ data: { posted: ["Company Wall"] } });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({
      createSurveyStore: async () =>
        memorySurveyStore({
          forms: [
            draftForm({
              status: "published",
              publishedAt: "2026-07-01T00:00:00.000Z",
            }),
          ],
        }),
      verifyToken,
    });
    const response = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/announce`,
      {
        body: JSON.stringify({ announce: { wall: true } }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("proxies publish with announce payload to Express", async () => {
    const upstream = vi.fn(async () =>
      Response.json({ data: { id: FORM_ID, status: "published" } }),
    );
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({
      createSurveyStore: async () =>
        memorySurveyStore({
          forms: [
            draftForm({
              questionCount: 1,
              questions: [
                {
                  id: QUESTION_ID,
                  order: 1,
                  type: "info",
                  prompt: "Intro",
                  helperText: null,
                  required: false,
                  options: [],
                  settings: {},
                },
              ],
            }),
          ],
        }),
      verifyToken,
    });

    const response = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/publish`,
      {
        body: JSON.stringify({ announce: { wall: true } }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });
});

describe("survey-forms dual-path routes", () => {
  it("uses survey:manage-wave for create and schedules on Hyperdrive", async () => {
    const store = memorySurveyStore({
      permissionsByUser: { "user-123": ["survey:manage-wave"] },
      forms: [draftForm({ createdById: "user-123", status: "draft" })],
    });

    const app = createEdgeApp({
      createSurveyFormsStore: async () => store,
      verifyToken,
    });

    const createResponse = await app.request(
      "https://intranet.example/api/survey-forms",
      {
        body: JSON.stringify({ title: "Wave form" }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(createResponse.status).toBe(201);

    const schedule = await app.request(
      `https://intranet.example/api/survey-forms/${FORM_ID}/schedule`,
      {
        body: JSON.stringify({ startDate: "2026-08-01" }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
      },
      hyperdriveEnv(),
    );
    expect(schedule.status).toBe(200);
    await expect(schedule.json()).resolves.toMatchObject({
      data: { startDate: "2026-08-01" },
    });
  });

  it("rejects create without survey:manage-wave", async () => {
    const store = memorySurveyStore({
      permissionsByUser: { "user-123": ["survey:manage"] },
    });
    const app = createEdgeApp({
      createSurveyFormsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/survey-forms",
      {
        body: JSON.stringify({ title: "Nope" }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(response.status).toBe(403);
  });
});
