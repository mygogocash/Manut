import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  createSurvey,
  createSurveyInputSchema,
  getMySurveyResponse,
  getSurvey,
  listSurveys,
  submitSurveyResponse,
  submitSurveyResponseInputSchema,
} from "../src/survey/survey";

describe("survey foundation contracts", () => {
  it("lists surveys without target user ids or creator email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "surv1",
          title: "Pulse",
          description: "Weekly pulse",
          status: "published",
          isAnonymous: true,
          targetUserIds: ["u1", "u2"],
          createdBy: {
            id: "u1",
            name: "Alex",
            email: "alex@manut.example",
          },
          _count: { questions: 3, responses: 10 },
          alreadyResponded: false,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listSurveys(client);
    expect(result.data[0]).toEqual({
      id: "surv1",
      title: "Pulse",
      description: "Weekly pulse",
      status: "published",
      isAnonymous: true,
      publishedAt: null,
      closedAt: null,
      alreadyResponded: false,
      questionCount: 3,
    });
    expect(result.data[0]).not.toHaveProperty("targetUserIds");
    expect(result.data[0]).not.toHaveProperty("createdBy");
  });

  it("loads survey detail with prompts and choice options", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        id: "surv1",
        title: "Pulse",
        status: "published",
        questions: [
          {
            id: "q1",
            order: 0,
            type: "rating",
            prompt: "How was your week?",
            required: true,
            options: [],
            helperText: "1-5",
          },
          {
            id: "q2",
            order: 1,
            type: "single_choice",
            prompt: "Team?",
            required: true,
            options: ["Eng", "Ops"],
            helperText: "pick one",
          },
        ],
      },
    });
    const client = { get } as unknown as ApiClient;

    const result = await getSurvey(client, "surv1");
    expect(result.questions[0]).toEqual({
      id: "q1",
      order: 0,
      type: "rating",
      prompt: "How was your week?",
      required: true,
      options: [],
    });
    expect(result.questions[1]).toEqual({
      id: "q2",
      order: 1,
      type: "single_choice",
      prompt: "Team?",
      required: true,
      options: ["Eng", "Ops"],
    });
    expect(result.questions[0]).not.toHaveProperty("helperText");
  });

  it("loads my-response without answer values", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        id: "resp1",
        answers: [
          { questionId: "q1", value: 5 },
          { questionId: "q2", value: "ok" },
        ],
      },
    });
    const client = { get } as unknown as ApiClient;

    const result = await getMySurveyResponse(client, "surv1");
    expect(result).toEqual({ id: "resp1", answerCount: 2 });
    expect(result).not.toHaveProperty("answers");
  });

  it("creates a draft survey via POST without target ids in the receipt", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: "surv-new",
        title: "Q3 pulse",
        description: "Optional notes",
        status: "draft",
        isAnonymous: false,
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

    const created = await createSurvey(client, {
      title: "Q3 pulse",
      description: "Optional notes",
      isAnonymous: false,
    });

    expect(created).toEqual({
      id: "surv-new",
      title: "Q3 pulse",
      description: "Optional notes",
      status: "draft",
      isAnonymous: false,
      publishedAt: null,
      closedAt: null,
      alreadyResponded: false,
      questionCount: 0,
      questions: [],
    });
    expect(created).not.toHaveProperty("targetUserIds");
    expect(created).not.toHaveProperty("createdBy");
    expect(post).toHaveBeenCalledWith("/survey", {
      title: "Q3 pulse",
      description: "Optional notes",
      isAnonymous: false,
      targetAll: true,
      targetEntityIds: [],
      targetDepartments: [],
      targetUserIds: [],
      questions: [],
    });
  });

  it("rejects empty create titles client-side", () => {
    expect(() => createSurveyInputSchema.parse({ title: "   " })).toThrow();
  });

  it("submits survey answers via POST and strips answer values", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: "resp-new",
        answers: [{ questionId: "11111111-1111-4111-8111-111111111111", value: 4 }],
      },
    });
    const client = { post } as unknown as ApiClient;
    const input = submitSurveyResponseInputSchema.parse({
      answers: [
        {
          questionId: "11111111-1111-4111-8111-111111111111",
          value: 4,
        },
      ],
    });

    const result = await submitSurveyResponse(client, "surv1", input);
    expect(result).toEqual({ id: "resp-new", answerCount: 1 });
    expect(result).not.toHaveProperty("answers");
    expect(post).toHaveBeenCalledWith("/survey/surv1/responses", input);
  });

  it("rejects invalid answer question ids client-side", () => {
    expect(() =>
      submitSurveyResponseInputSchema.parse({
        answers: [{ questionId: "not-a-uuid", value: "x" }],
      }),
    ).toThrow();
  });
});
