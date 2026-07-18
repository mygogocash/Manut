import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listCareerJobs } from "../src/careers/careers";

const jobRecord = {
  id: "a0000000-0000-4000-8000-000000000010",
  title: "Platform Engineer",
  slug: "platform-engineer",
  type: "full_time",
  location: "Bangkok",
  department: "Engineering",
  description: "Build the intranet platform.",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  _count: { applications: 3 },
};

describe("careers foundation contracts", () => {
  it("lists job postings with application counts", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [jobRecord],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listCareerJobs(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: jobRecord.id,
      title: "Platform Engineer",
      type: "full_time",
      location: "Bangkok",
      department: "Engineering",
      description: "Build the intranet platform.",
      active: true,
      applicationCount: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.data[0]).not.toHaveProperty("slug");
    expect(result.data[0]).not.toHaveProperty("_count");
    expect(get).toHaveBeenCalledWith(
      "/career?page=1&limit=20",
      undefined,
    );
  });

  it("forwards active and search filters", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    const client = { get } as unknown as ApiClient;

    await listCareerJobs(client, {
      page: 1,
      limit: 10,
      active: true,
      search: "engineer",
      department: "Engineering",
    });
    expect(get).toHaveBeenCalledWith(
      "/career?page=1&limit=10&department=Engineering&active=true&search=engineer",
      undefined,
    );
  });
});
