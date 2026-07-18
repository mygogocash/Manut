import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getSurveyForm,
  listSurveyForms,
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

  it("loads survey form detail prompts only", async () => {
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
    expect(result.questions[0]?.prompt).toBe("Team?");
  });
});
