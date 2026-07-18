import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  createSurveyForm,
  createSurveyFormInputSchema,
  getSurveyForm,
  listSurveyForms,
  publishSurveyForm,
  replaceSurveyFormQuestions,
  replaceSurveyFormQuestionsInputSchema,
  surveyFormQuestionInputSchema,
} from "../src/survey-forms/survey-forms";

describe("survey-forms foundation contracts", () => {
  it("lists survey forms without target ids or creator email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "form1",
          title: "Onboarding",
          description: null,
          status: "published",
          targetUserIds: ["u1"],
          createdBy: {
            id: "u1",
            name: "Alex",
            email: "alex@manut.example",
          },
          _count: { questions: 2, responses: 4 },
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listSurveyForms(client);
    expect(result.data[0]).toEqual({
      id: "form1",
      title: "Onboarding",
      description: null,
      status: "published",
      isAnonymous: false,
      publishedAt: null,
      closedAt: null,
      alreadyResponded: false,
      questionCount: 2,
    });
    expect(get).toHaveBeenCalledWith("/survey-forms?page=1&limit=20", undefined);
  });

  it("loads survey form detail prompts and options", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        id: "form1",
        title: "Onboarding",
        status: "published",
        questions: [
          {
            id: "q1",
            order: 0,
            type: "short_text",
            prompt: "Team?",
            required: true,
            options: [],
          },
        ],
      },
    });
    const client = { get } as unknown as ApiClient;

    const result = await getSurveyForm(client, "form1");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toEqual({
      id: "q1",
      order: 0,
      type: "short_text",
      prompt: "Team?",
      required: true,
      options: [],
    });
  });

  it("creates a draft survey form via POST without target ids in the receipt", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: "form-new",
        title: "Exit interview",
        description: null,
        status: "draft",
        isAnonymous: true,
        targetUserIds: ["u1"],
        createdBy: {
          id: "u1",
          name: "Alex",
          email: "alex@manut.example",
        },
        _count: { questions: 0, responses: 0 },
      },
    });
    const client = { post } as unknown as ApiClient;

    const created = await createSurveyForm(client, {
      title: "Exit interview",
      isAnonymous: true,
    });

    expect(created).toEqual({
      id: "form-new",
      title: "Exit interview",
      description: null,
      status: "draft",
      isAnonymous: true,
      publishedAt: null,
      closedAt: null,
      alreadyResponded: false,
      questionCount: 0,
      questions: [],
    });
    expect(created).not.toHaveProperty("targetUserIds");
    expect(post).toHaveBeenCalledWith("/survey-forms", {
      title: "Exit interview",
      description: null,
      isAnonymous: true,
      targetAll: true,
      targetEntityIds: [],
      targetDepartments: [],
      targetUserIds: [],
      questions: [],
    });
  });

  it("rejects empty survey-form create titles client-side", () => {
    expect(() => createSurveyFormInputSchema.parse({ title: "" })).toThrow();
  });

  it("replaces survey-form questions via PUT without target ids in the receipt", async () => {
    const put = vi.fn().mockResolvedValue({
      data: {
        id: "form1",
        title: "Onboarding",
        status: "draft",
        targetUserIds: ["u1"],
        createdBy: {
          id: "u1",
          name: "Alex",
          email: "alex@manut.example",
        },
        questions: [
          {
            id: "q1",
            order: 0,
            type: "rating",
            prompt: "Clarity?",
            required: true,
            options: [],
          },
        ],
        _count: { questions: 1, responses: 0 },
      },
    });
    const client = { put } as unknown as ApiClient;
    const input = replaceSurveyFormQuestionsInputSchema.parse({
      questions: [
        {
          type: "rating",
          prompt: "Clarity?",
          required: true,
        },
      ],
    });

    const result = await replaceSurveyFormQuestions(client, "form1", input);
    expect(result.questions[0]).toEqual({
      id: "q1",
      order: 0,
      type: "rating",
      prompt: "Clarity?",
      required: true,
      options: [],
    });
    expect(result).not.toHaveProperty("targetUserIds");
    expect(put).toHaveBeenCalledWith("/survey-forms/form1/questions", {
      questions: [
        {
          type: "rating",
          prompt: "Clarity?",
          required: true,
          options: [],
          settings: {},
          helperText: null,
        },
      ],
    });
  });

  it("rejects choice questions with fewer than two options client-side", () => {
    expect(() =>
      surveyFormQuestionInputSchema.parse({
        type: "multi_choice",
        prompt: "Pick many",
        options: ["one"],
      }),
    ).toThrow();
  });

  it("publishes a draft survey form via POST without announce payload", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: "form1",
        title: "Onboarding",
        status: "published",
        publishedAt: "2026-07-18T00:00:00.000Z",
        questions: [
          {
            id: "q1",
            order: 0,
            type: "short_text",
            prompt: "Team?",
            required: true,
            options: [],
          },
        ],
        _count: { questions: 1, responses: 0 },
      },
    });
    const client = { post } as unknown as ApiClient;

    const result = await publishSurveyForm(client, "form1");
    expect(result.status).toBe("published");
    expect(post).toHaveBeenCalledWith("/survey-forms/form1/publish", {});
  });
});
