import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getMySurveyResponse,
  getSurvey,
  listSurveys,
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

  it("loads survey detail with prompts only", async () => {
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
});
