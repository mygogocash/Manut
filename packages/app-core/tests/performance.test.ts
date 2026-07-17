import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  appraisalListParamsSchema,
  appraisalSchema,
  getAppraisal,
  listAppraisals,
  performanceAppraisalsQueryKey,
  performanceDetailQueryKey,
} from "../src/performance/performance";

const goal = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  appraisalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Ship Expo parity",
  description: null,
  weight: 40,
  selfScore: 4,
  managerScore: null,
  status: "in_progress" as const,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-02T10:00:00.000Z",
};

const appraisal = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  cycleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  employeeId: "11111111-1111-4111-8111-111111111111",
  managerId: "22222222-2222-4222-8222-222222222222",
  status: "self_review" as const,
  selfRating: 4,
  selfComment: "On track",
  managerRating: null,
  managerComment: null,
  finalRating: null,
  completedAt: null,
  cycle: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "H1 2026",
    status: "active",
  },
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
  },
  manager: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Manager",
    email: "manager@manut.example",
  },
  goals: [goal],
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-02T09:00:00.000Z",
};

describe("performance contracts", () => {
  it("accepts appraisal receipts and rejects unknown status values", () => {
    expect(appraisalSchema.safeParse(appraisal).success).toBe(true);
    expect(
      appraisalSchema.safeParse({
        ...appraisal,
        status: "draft",
      }).success,
    ).toBe(false);
  });

  it("normalizes and bounds list parameters", () => {
    expect(
      appraisalListParamsSchema.parse({
        page: 2,
        limit: 20,
        cycleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "self_review",
      }),
    ).toEqual({
      page: 2,
      limit: 20,
      cycleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "self_review",
    });
    expect(
      appraisalListParamsSchema.safeParse({ page: 0, limit: 101 }).success,
    ).toBe(false);
  });

  it("separates list and detail query caches", () => {
    expect(performanceAppraisalsQueryKey({ page: 1 })).not.toEqual(
      performanceDetailQueryKey(appraisal.id),
    );
  });

  it("encodes list filters, forwards aborts, and parses pagination", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [appraisal],
      meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listAppraisals(
        client,
        {
          page: 2,
          limit: 20,
          cycleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          status: "self_review",
        },
        signal,
      ),
    ).resolves.toMatchObject({ data: [appraisal], meta: { totalPages: 2 } });

    expect(get).toHaveBeenCalledWith(
      "/performance/appraisals?page=2&limit=20&cycleId=cccccccc-cccc-4ccc-8ccc-cccccccccccc&status=self_review",
      { signal },
    );
  });

  it("loads appraisal detail and strips unexpected extras", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        ...appraisal,
        internalNote: "strip-me",
      },
    });
    const client = { get } as unknown as ApiClient;

    const detail = await getAppraisal(client, appraisal.id);
    expect(detail).toMatchObject({
      id: appraisal.id,
      status: "self_review",
      goals: [goal],
    });
    expect(detail).not.toHaveProperty("internalNote");
    expect(get).toHaveBeenCalledWith(
      `/performance/appraisals/${appraisal.id}`,
      undefined,
    );
  });
});
