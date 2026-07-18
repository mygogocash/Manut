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
      return {
        ...row,
        submittedAt: "2026-07-18T12:00:00.000Z",
      };
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

  it("proxies announce/analytics leftovers even when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe(
        `/api/survey/${FORM_ID}/analytics`,
      );
      return Response.json({ data: { totalResponses: 0, questions: [] } });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({
      createSurveyStore: async () => memorySurveyStore(),
      verifyToken,
    });
    const response = await app.request(
      `https://intranet.example/api/survey/${FORM_ID}/analytics`,
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
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
  it("uses survey:manage-wave for create and proxies schedule leftovers", async () => {
    const store = memorySurveyStore({
      permissionsByUser: { "user-123": ["survey:manage-wave"] },
    });
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe(
        `/api/survey-forms/${FORM_ID}/schedule`,
      );
      return Response.json({ data: {} });
    });
    vi.stubGlobal("fetch", upstream);

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
    expect(upstream).toHaveBeenCalledOnce();
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
