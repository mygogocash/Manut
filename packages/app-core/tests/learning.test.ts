import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listLearningModules } from "../src/learning/learning";

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
