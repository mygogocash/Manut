import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listAdminDepartments } from "../src/admin/form-config";

describe("admin form-config foundation contracts", () => {
  it("lists departments without timestamps", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "dept1",
          name: "Engineering",
          code: "ENG",
          description: "Product eng",
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    const client = { get } as unknown as ApiClient;

    const result = await listAdminDepartments(client);
    expect(result.data[0]).toEqual({
      id: "dept1",
      name: "Engineering",
      code: "ENG",
      description: "Product eng",
      isActive: true,
    });
    expect(result.data[0]).not.toHaveProperty("createdAt");
    expect(get).toHaveBeenCalledWith("/admin/departments", undefined);
  });
});
