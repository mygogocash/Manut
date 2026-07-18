import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { getAdminUserStats } from "../src/admin/admin-hub";

describe("admin hub foundation contracts", () => {
  it("loads user counts without employment-type breakdown extras", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        total: 40,
        active: 35,
        inactive: 5,
        newThisMonth: 2,
        byEmploymentType: [{ employmentType: "full-time", _count: 30 }],
      },
    });
    const client = { get } as unknown as ApiClient;

    const result = await getAdminUserStats(client);
    expect(result).toEqual({
      total: 40,
      active: 35,
      inactive: 5,
      newThisMonth: 2,
    });
    expect(result).not.toHaveProperty("byEmploymentType");
    expect(get).toHaveBeenCalledWith("/admin/users/stats", undefined);
  });
});
