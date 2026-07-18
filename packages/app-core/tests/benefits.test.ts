import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listBenefitCatalog,
  listMyBenefitEnrollments,
} from "../src/benefits/benefits";

const benefit = {
  id: "clbenefit00000000000000001",
  name: "Health Plus",
  category: "health",
  description: "Core medical plan",
  provider: "Manut Care",
  cost: "1200.00",
  currency: "THB",
  entityId: "clentity00000000000000001",
  entity: { id: "clentity00000000000000001", name: "Manut Ops" },
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  _count: { enrollments: 12 },
};

const enrollment = {
  id: "clenroll000000000000000001",
  benefitId: benefit.id,
  employeeId: "11111111-1111-4111-8111-111111111111",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
  },
  startDate: "2026-01-15T00:00:00.000Z",
  endDate: null,
  status: "active",
  benefit: {
    id: benefit.id,
    name: "Health Plus",
    category: "health",
    provider: "Manut Care",
    cost: "1200.00",
    currency: "THB",
  },
};

describe("benefits foundation contracts", () => {
  it("lists catalog benefits with enrollment counts only", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [benefit],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listBenefitCatalog(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: benefit.id,
      name: "Health Plus",
      category: "health",
      description: "Core medical plan",
      provider: "Manut Care",
      cost: "1200.00",
      currency: "THB",
      isActive: true,
      entityName: "Manut Ops",
      enrollmentCount: 12,
    });
    expect(result.data[0]).not.toHaveProperty("_count");
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/benefits?"),
      undefined,
    );
  });

  it("lists my enrollments without employee email", async () => {
    const get = vi.fn().mockResolvedValue({ data: [enrollment] });
    const client = { get } as unknown as ApiClient;

    const result = await listMyBenefitEnrollments(client);
    expect(result).toEqual([
      {
        id: enrollment.id,
        benefitId: benefit.id,
        status: "active",
        startDate: "2026-01-15",
        endDate: null,
        benefitName: "Health Plus",
        benefitCategory: "health",
        provider: "Manut Care",
        cost: "1200.00",
        currency: "THB",
      },
    ]);
    expect(result[0]).not.toHaveProperty("employee");
    expect(get).toHaveBeenCalledWith("/benefits/my-enrollments", undefined);
  });
});
