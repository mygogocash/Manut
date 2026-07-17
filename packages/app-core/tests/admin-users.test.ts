import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  adminUserListParamsSchema,
  adminUserSchema,
  listAdminUsers,
} from "../src/admin/admin-users";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@manut.example",
  name: "Person Example",
  phone: null,
  department: "Operations",
  jobTitle: "Coordinator",
  employeeId: "E-100",
  employmentType: "full_time",
  location: null,
  country: null,
  isActive: true,
  entity: { id: "entity-1", name: "Manut Ops" },
  manager: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Manager",
    email: "manager@manut.example",
  },
  roles: [{ id: "33333333-3333-4333-8333-333333333333", name: "Employee" }],
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("admin users contracts", () => {
  it("accepts list receipts and rejects missing identity fields", () => {
    expect(adminUserSchema.safeParse(user).success).toBe(true);
    expect(
      adminUserSchema.safeParse({ ...user, email: "" }).success,
    ).toBe(false);
  });

  it("normalizes list params and encodes isActive as a query string", () => {
    expect(
      adminUserListParamsSchema.parse({
        page: 1,
        limit: 20,
        search: " Person ",
        isActive: true,
      }),
    ).toEqual({
      page: 1,
      limit: 20,
      search: "Person",
      isActive: true,
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(
      adminUserListParamsSchema.safeParse({ page: 0, limit: 101 }).success,
    ).toBe(false);
  });

  it("lists users under /admin/users and strips sensitive extras", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          ...user,
          salary: "99999",
          passportNumber: "X123",
          avatarUrl: "https://cdn.example/a.png",
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listAdminUsers(
      client,
      { page: 1, limit: 20, isActive: true, search: "Person" },
      signal,
    );

    expect(result.data[0]).toMatchObject({
      id: user.id,
      name: user.name,
      isActive: true,
    });
    expect(result.data[0]).not.toHaveProperty("salary");
    expect(result.data[0]).not.toHaveProperty("passportNumber");
    expect(result.data[0]).not.toHaveProperty("avatarUrl");
    expect(get).toHaveBeenCalledWith(
      "/admin/users?page=1&limit=20&search=Person&isActive=true&sortBy=name&sortOrder=asc",
      { signal },
    );
  });
});
