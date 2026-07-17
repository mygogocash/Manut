import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listRoles, roleSchema } from "../src/admin/roles";

const role = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Employee",
  description: "Default employee role",
  isSystem: true,
  permissionCount: 12,
  userCount: 40,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("roles contracts", () => {
  it("accepts role receipts and rejects empty names", () => {
    expect(roleSchema.safeParse(role).success).toBe(true);
    expect(roleSchema.safeParse({ ...role, name: "" }).success).toBe(false);
  });

  it("lists roles and strips the full permissions array", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          ...role,
          permissions: ["home:read", "leave:read", "secret:internal"],
        },
      ],
    });
    const client = { get } as unknown as ApiClient;

    const result = await listRoles(client, signal);

    expect(result).toEqual([role]);
    expect(result[0]).not.toHaveProperty("permissions");
    expect(get).toHaveBeenCalledWith("/roles", { signal });
  });
});
