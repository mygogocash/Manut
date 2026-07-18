import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listApplications } from "../src/applications/applications";

const applicationRecord = {
  id: "a0000000-0000-4000-8000-000000000020",
  name: "Jordan Applicant",
  email: "jordan@example.com",
  mobile: "+66123456789",
  linkedin: "https://linkedin.com/in/jordan",
  website: "https://jordan.example",
  attachment: "r2://private/resumes/jordan.pdf",
  jobId: "a0000000-0000-4000-8000-000000000010",
  createdAt: "2026-02-01T12:00:00.000Z",
  job: {
    id: "a0000000-0000-4000-8000-000000000010",
    title: "Platform Engineer",
    department: "Engineering",
    location: "Bangkok",
  },
};

describe("applications foundation contracts", () => {
  it("lists applications and strips resume storage urls", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [applicationRecord],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listApplications(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: applicationRecord.id,
      name: "Jordan Applicant",
      email: "jordan@example.com",
      mobile: "+66123456789",
      linkedin: "https://linkedin.com/in/jordan",
      website: "https://jordan.example",
      hasResume: true,
      createdAt: "2026-02-01T12:00:00.000Z",
      job: {
        id: applicationRecord.job.id,
        title: "Platform Engineer",
        department: "Engineering",
        location: "Bangkok",
      },
    });
    expect(result.data[0]).not.toHaveProperty("attachment");
    expect(get).toHaveBeenCalledWith(
      "/applications?page=1&limit=20",
      undefined,
    );
  });

  it("forwards jobId and search filters", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    const client = { get } as unknown as ApiClient;

    await listApplications(client, {
      page: 1,
      limit: 10,
      jobId: applicationRecord.jobId,
      search: "jordan",
    });
    expect(get).toHaveBeenCalledWith(
      `/applications?page=1&limit=10&jobId=${applicationRecord.jobId}&search=jordan`,
      undefined,
    );
  });
});
