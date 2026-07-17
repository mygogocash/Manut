import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { directoryRepository } from "@/modules/directory/directory.repository";
import { DirectoryService } from "@/modules/directory/directory.service";

vi.mock("@/modules/directory/directory.repository", () => ({
  directoryRepository: {
    findAllEmployees: vi.fn(),
  },
}));

const findAllEmployees = directoryRepository.findAllEmployees as Mock;

const employee = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Person",
  email: "person@manut.example",
  phone: "+66 80 000 0000",
  phonePublic: false,
  salary: "100000.00",
  currency: "THB",
};

describe("DirectoryService privacy projection", () => {
  let service: DirectoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    findAllEmployees.mockResolvedValue({ data: [employee], total: 1 });
    service = new DirectoryService();
  });

  it("omits private phone and compensation fields for standard readers", async () => {
    const result = await service.list({ page: 1, limit: 20 }, false);

    expect(result.data[0]).toEqual({
      id: employee.id,
      name: employee.name,
      email: employee.email,
    });
    expect(result.data[0]).not.toHaveProperty("phonePublic");
  });

  it("retains an opted-in phone while keeping compensation private", async () => {
    findAllEmployees.mockResolvedValue({
      data: [{ ...employee, phonePublic: true }],
      total: 1,
    });

    const result = await service.list({ page: 1, limit: 20 }, false);

    expect(result.data[0]).toMatchObject({ phone: employee.phone });
    expect(result.data[0]).not.toHaveProperty("salary");
    expect(result.data[0]).not.toHaveProperty("currency");
    expect(result.data[0]).not.toHaveProperty("phonePublic");
  });

  it("retains sensitive fields for authorized readers but never leaks the flag", async () => {
    const result = await service.list({ page: 1, limit: 20 }, true);

    expect(result.data[0]).toMatchObject({
      phone: employee.phone,
      salary: employee.salary,
      currency: employee.currency,
    });
    expect(result.data[0]).not.toHaveProperty("phonePublic");
  });

  it.each([
    { isActive: false, deletedAt: null },
    { isActive: true, deletedAt: new Date("2026-07-17T00:00:00.000Z") },
  ])("omits an unavailable manager from public results", async (lifecycle) => {
    findAllEmployees.mockResolvedValue({
      data: [
        {
          ...employee,
          manager: {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Former manager",
            email: "former-manager@manut.example",
            jobTitle: "Manager",
            avatarUrl: null,
            ...lifecycle,
          },
        },
      ],
      total: 1,
    });

    const result = await service.list({ page: 1, limit: 20 }, false);

    expect(result.data[0]).toMatchObject({ manager: null });
  });

  it("returns an active manager without internal lifecycle fields", async () => {
    findAllEmployees.mockResolvedValue({
      data: [
        {
          ...employee,
          manager: {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Current manager",
            email: "current-manager@manut.example",
            jobTitle: "Manager",
            avatarUrl: null,
            isActive: true,
            deletedAt: null,
          },
        },
      ],
      total: 1,
    });

    const result = await service.list({ page: 1, limit: 20 }, false);

    expect(result.data[0]).toMatchObject({
      manager: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Current manager",
      },
    });
    expect(result.data[0]?.manager).not.toHaveProperty("isActive");
    expect(result.data[0]?.manager).not.toHaveProperty("deletedAt");
  });
});
