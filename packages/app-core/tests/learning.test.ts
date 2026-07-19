import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listLearningCompletions,
  listLearningModules,
  markLearningComplete,
} from "../src/learning/learning";

const moduleRecord = {
  id: "cllearningmod0000000000001",
  title: "Security Basics",
  description: "Required annual training",
  category: "compliance",
  duration: 45,
  url: "https://learn.manut.example/security",
  fileUrl: "r2://private/security.pdf",
  fileName: "security.pdf",
  isMandatory: true,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("learning foundation contracts", () => {
  it("lists modules and strips storage file urls", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [moduleRecord],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listLearningModules(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: moduleRecord.id,
      title: "Security Basics",
      description: "Required annual training",
      category: "compliance",
      durationMinutes: 45,
      externalUrl: "https://learn.manut.example/security",
      hasAttachment: true,
      attachmentName: "security.pdf",
      isMandatory: true,
    });
    expect(result.data[0]).not.toHaveProperty("fileUrl");
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/learning/modules?"),
      undefined,
    );
  });

  it("marks a module complete and strips employee email", async () => {
    const completionRecord = {
      id: "cllearningcomp000000000001",
      moduleId: moduleRecord.id,
      employeeId: "cluser00000000000000000001",
      completedAt: "2026-02-01T12:00:00.000Z",
      score: null,
      module: {
        id: moduleRecord.id,
        title: moduleRecord.title,
        category: moduleRecord.category,
      },
      employee: {
        id: "cluser00000000000000000001",
        name: "Alex Learner",
        email: "alex@manut.example",
      },
    };
    const post = vi.fn().mockResolvedValue({ data: completionRecord });
    const client = { post } as unknown as ApiClient;

    const result = await markLearningComplete(client, {
      moduleId: moduleRecord.id,
    });

    expect(result).toEqual({
      id: completionRecord.id,
      moduleId: moduleRecord.id,
      completedAt: completionRecord.completedAt,
      score: null,
      moduleTitle: moduleRecord.title,
      moduleCategory: moduleRecord.category,
    });
    expect(result).not.toHaveProperty("employee");
    expect(post).toHaveBeenCalledWith("/learning/completions", {
      moduleId: moduleRecord.id,
    });
  });

  it("lists completions without exposing employee email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "cllearningcomp000000000001",
          moduleId: moduleRecord.id,
          employeeId: "cluser00000000000000000001",
          completedAt: "2026-02-01T12:00:00.000Z",
          score: 95,
          module: {
            id: moduleRecord.id,
            title: moduleRecord.title,
            category: moduleRecord.category,
          },
          employee: {
            id: "cluser00000000000000000001",
            name: "Alex Learner",
            email: "alex@manut.example",
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listLearningCompletions(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: "cllearningcomp000000000001",
      moduleId: moduleRecord.id,
      completedAt: "2026-02-01T12:00:00.000Z",
      score: 95,
      moduleTitle: moduleRecord.title,
      moduleCategory: moduleRecord.category,
    });
    expect(result.data[0]).not.toHaveProperty("employee");
    expect(get).toHaveBeenCalledWith(
      "/learning/completions?page=1&limit=20",
      undefined,
    );
  });

  it("forwards optional category and search filters", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const client = { get } as unknown as ApiClient;

    await listLearningModules(client, {
      page: 1,
      limit: 10,
      category: "compliance",
      search: "security",
    });
    expect(get).toHaveBeenCalledWith(
      "/learning/modules?page=1&limit=10&category=compliance&search=security",
      undefined,
    );
  });
});
