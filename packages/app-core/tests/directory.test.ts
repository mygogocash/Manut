import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  directoryEmployeeDetailSchema,
  directoryEmployeeSchema,
  directoryListQueryKey,
  directoryParamsSchema,
  getDirectoryDepartments,
  getDirectoryEmployee,
  listDirectory,
} from "../src/directory/directory";

const employee = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Person",
  email: "person@manut.example",
  avatarUrl: null,
  department: "Operations",
  jobTitle: "Coordinator",
  employeeId: "MNT-001",
  employmentType: "full_time",
  location: "Bangkok",
  country: "Thailand",
  isActive: true,
  startDate: null,
  entity: { id: "entity-1", name: "Manut", code: "MNT" },
  manager: null,
};

describe("directory contracts", () => {
  it("accepts omitted sensitive fields and rejects the internal privacy flag", () => {
    expect(directoryEmployeeSchema.safeParse(employee).success).toBe(true);
    expect(
      directoryEmployeeSchema.safeParse({
        ...employee,
        phonePublic: false,
      }).success,
    ).toBe(false);
  });

  it("normalizes and bounds list parameters", () => {
    expect(
      directoryParamsSchema.parse({
        page: 2,
        limit: 24,
        search: "  Person & Team  ",
        department: " Operations ",
      }),
    ).toEqual({
      page: 2,
      limit: 24,
      search: "Person & Team",
      department: "Operations",
    });
    expect(
      directoryParamsSchema.safeParse({ page: 0, limit: 501 }).success,
    ).toBe(false);
  });

  it("separates standard and sensitive directory caches", () => {
    expect(directoryListQueryKey({ page: 1 }, "standard")).not.toEqual(
      directoryListQueryKey({ page: 1 }, "sensitive"),
    );
  });

  it("encodes list filters, forwards aborts, and parses pagination", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [employee],
      meta: { page: 2, limit: 24, total: 25, totalPages: 2 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listDirectory(
        client,
        {
          page: 2,
          limit: 24,
          search: "Person & Team",
          department: "Operations",
        },
        signal,
      ),
    ).resolves.toMatchObject({ data: [employee], meta: { totalPages: 2 } });

    expect(get).toHaveBeenCalledWith(
      "/directory?page=2&limit=24&search=Person%20%26%20Team&department=Operations",
      { signal },
    );
  });

  it("parses the runtime department list without a built-in catalogue", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [{ name: "Operations", count: 3 }],
    });
    const client = { get } as unknown as ApiClient;

    await expect(getDirectoryDepartments(client)).resolves.toEqual([
      { name: "Operations", count: 3 },
    ]);
    expect(get).toHaveBeenCalledWith("/directory/departments", undefined);
  });

  it("projects employee detail without internal metadata", () => {
    const parsed = directoryEmployeeDetailSchema.parse({
      ...employee,
      timezone: "Asia/Bangkok",
      createdAt: "2026-01-15T08:00:00.000Z",
      metadata: { legacyNote: "strip-me" },
      phonePublic: false,
      directReports: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Report",
          jobTitle: "Analyst",
          avatarUrl: null,
          department: "Operations",
        },
      ],
      userRoles: [{ role: { id: "role-1", name: "Employee" } }],
    });

    expect(parsed.timezone).toBe("Asia/Bangkok");
    expect(parsed.directReports).toHaveLength(1);
    expect(parsed.userRoles[0]?.role.name).toBe("Employee");
    expect(parsed).not.toHaveProperty("metadata");
    expect(parsed).not.toHaveProperty("phonePublic");
  });

  it("loads abortable employee detail through the shared client", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: {
        ...employee,
        timezone: null,
        createdAt: "2026-01-15T08:00:00.000Z",
        metadata: { ignore: true },
        directReports: [],
        userRoles: [],
      },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      getDirectoryEmployee(
        client,
        "11111111-1111-4111-8111-111111111111",
        signal,
      ),
    ).resolves.toMatchObject({
      id: employee.id,
      name: "Person",
      directReports: [],
      userRoles: [],
    });
    expect(get).toHaveBeenCalledWith(
      "/directory/11111111-1111-4111-8111-111111111111",
      { signal },
    );
  });
});
