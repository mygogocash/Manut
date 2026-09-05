import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { rolesRepository } from "@/modules/roles/roles.repository";
import { RolesService } from "@/modules/roles/roles.service";

vi.mock("./roles.repository", () => ({
  rolesRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("RolesService", () => {
  let rolesService: RolesService;

  beforeEach(() => {
    rolesService = new RolesService();
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return all roles", async () => {
      const mockRoles = [
        {
          id: "role-1",
          name: "Admin",
          description: "Administrator role",
          isSystem: true,
          createdAt: new Date(),
          rolePermissions: Array.from({ length: 10 }, (_, i) => ({
            permissionCode: `perm:${i}`,
          })),
          _count: { userRoles: 5 },
        },
        {
          id: "role-2",
          name: "Manager",
          description: "Manager role",
          isSystem: false,
          createdAt: new Date(),
          rolePermissions: Array.from({ length: 5 }, (_, i) => ({
            permissionCode: `m:${i}`,
          })),
          _count: { userRoles: 10 },
        },
      ];

      (rolesRepository.findAll as Mock).mockResolvedValue(mockRoles);

      const result = await rolesService.list();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe("Admin");
      expect(result.data[0].permissionCount).toBe(10);
      expect(result.data[0].userCount).toBe(5);
    });
  });

  describe("getById", () => {
    it("should return role by ID with permissions", async () => {
      const mockRole = {
        id: "role-1",
        name: "Admin",
        description: "Administrator role",
        isSystem: true,
        rolePermissions: [
          { permissionCode: "admin:view" },
          { permissionCode: "admin:manage" },
        ],
        _count: { userRoles: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (rolesRepository.findById as Mock).mockResolvedValue(mockRole);

      const result = await rolesService.getById("role-1");

      expect(result.data.id).toBe("role-1");
      expect(result.data.permissions).toContain("admin:view");
      expect(result.data.permissions).toContain("admin:manage");
    });

    it("should throw NotFoundException when role not found", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue(null);

      await expect(rolesService.getById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create", () => {
    const createInput = {
      name: "New Role",
      description: "A new role",
      permissions: ["leave:view", "leave:request"],
    };

    it("should create role successfully", async () => {
      (rolesRepository.findByName as Mock).mockResolvedValue(null);
      (rolesRepository.create as Mock).mockResolvedValue({
        id: "new-role",
        name: "New Role",
        description: "A new role",
        isSystem: false,
        rolePermissions: [
          { permissionCode: "leave:view" },
          { permissionCode: "leave:request" },
        ],
        _count: { userRoles: 0 },
      });

      const result = await rolesService.create(createInput);

      expect(result.data.id).toBe("new-role");
      expect(result.data.name).toBe("New Role");
      expect(result.data.permissions).toContain("leave:view");
    });

    it("should throw ConflictException when name already exists", async () => {
      (rolesRepository.findByName as Mock).mockResolvedValue({
        id: "existing",
      });

      await expect(rolesService.create(createInput)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should allow creating a role named Admin when no duplicate exists", async () => {
      (rolesRepository.findByName as Mock).mockResolvedValue(null);
      (rolesRepository.create as Mock).mockResolvedValue({
        id: "new-role",
        name: "  ADMIN  ",
        description: "x",
        isSystem: false,
        rolePermissions: [{ permissionCode: "leave:view" }],
        _count: { userRoles: 0 },
      });

      const result = await rolesService.create({
        name: "  ADMIN  ",
        description: "x",
        permissions: ["leave:view"],
      });

      expect(result.data.name).toBe("  ADMIN  ");
      expect(rolesRepository.create).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update role successfully", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-1",
        name: "Old Name",
        isSystem: false,
        rolePermissions: [],
      });
      (rolesRepository.findByName as Mock).mockResolvedValue(null);
      (rolesRepository.update as Mock).mockResolvedValue({
        id: "role-1",
        name: "Updated Name",
        description: "Updated description",
        isSystem: false,
        rolePermissions: [{ permissionCode: "admin:view" }],
        _count: { userRoles: 5 },
      });

      const result = await rolesService.update("role-1", {
        name: "Updated Name",
        description: "Updated description",
      });

      expect(result.data.name).toBe("Updated Name");
    });

    it("should throw NotFoundException when role not found", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue(null);

      await expect(
        rolesService.update("non-existent", { name: "Test" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when updating the Admin system role", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-1",
        name: "Admin",
        isSystem: true,
        rolePermissions: [],
      });

      await expect(
        rolesService.update("role-1", { name: "Super Admin" }),
      ).rejects.toThrow(BadRequestException);
      expect(rolesRepository.update).not.toHaveBeenCalled();
    });

    it("should allow updating non-Admin system roles", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-emp",
        name: "Employee",
        isSystem: true,
        rolePermissions: [{ permissionCode: "leave:view" }],
      });
      (rolesRepository.findByName as Mock).mockResolvedValue(null);
      (rolesRepository.update as Mock).mockResolvedValue({
        id: "role-emp",
        name: "Employee",
        description: "Updated description",
        isSystem: true,
        rolePermissions: [{ permissionCode: "leave:view" }],
        _count: { userRoles: 10 },
      });

      const result = await rolesService.update("role-emp", {
        description: "Updated description",
      });

      expect(result.data.description).toBe("Updated description");
      expect(rolesRepository.update).toHaveBeenCalled();
    });

    it("allows updating a custom role even when it grants admin:manage", async () => {
      // Reverses the Phase 1 lock that treated `admin:manage` as a proxy
      // for "system" — see #123 / #127. Custom roles (e.g. "IT") that
      // legitimately need that permission must remain editable.
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-it",
        name: "Information Technology",
        isSystem: false,
        rolePermissions: [{ permissionCode: "admin:manage" }],
        _count: { userRoles: 0 },
      });
      (rolesRepository.findByName as Mock).mockResolvedValue(null);
      (rolesRepository.update as Mock).mockResolvedValue({
        id: "role-it",
        name: "Information Technology",
        description: "Edited",
        isSystem: false,
        rolePermissions: [{ permissionCode: "admin:manage" }],
        _count: { userRoles: 0 },
      });

      const result = await rolesService.update("role-it", {
        description: "Edited",
      });

      expect(result.data.description).toBe("Edited");
      expect(rolesRepository.update).toHaveBeenCalled();
    });

    it("should allow renaming a role to admin when unique", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-1",
        name: "Manager",
        isSystem: false,
        rolePermissions: [],
      });
      (rolesRepository.findByName as Mock).mockResolvedValue(null);
      (rolesRepository.update as Mock).mockResolvedValue({
        id: "role-1",
        name: "admin",
        description: null,
        isSystem: false,
        rolePermissions: [],
        _count: { userRoles: 0 },
      });

      const result = await rolesService.update("role-1", { name: "admin" });

      expect(result.data.name).toBe("admin");
      expect(rolesRepository.update).toHaveBeenCalled();
    });

    it("should throw ConflictException when new name already exists", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-1",
        name: "Old Name",
        isSystem: false,
        rolePermissions: [],
      });
      (rolesRepository.findByName as Mock).mockResolvedValue({
        id: "other-role",
      });

      await expect(
        rolesService.update("role-1", { name: "Existing Name" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("remove", () => {
    it("should delete role successfully", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isSystem: false,
        rolePermissions: [],
      });
      (rolesRepository.delete as Mock).mockResolvedValue(undefined);

      const result = await rolesService.remove("role-1");

      expect(result.data.id).toBe("role-1");
      expect(rolesRepository.delete).toHaveBeenCalledWith("role-1");
    });

    it("should throw NotFoundException when role not found", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue(null);

      await expect(rolesService.remove("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException when deleting the Admin system role", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-1",
        name: "Admin",
        isSystem: true,
        rolePermissions: [],
      });

      await expect(rolesService.remove("role-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(rolesRepository.delete).not.toHaveBeenCalled();
    });

    it("should allow deleting non-Admin system roles", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-emp",
        name: "Employee",
        isSystem: true,
        rolePermissions: [],
      });
      (rolesRepository.delete as Mock).mockResolvedValue(undefined);

      const result = await rolesService.remove("role-emp");

      expect(result.data.id).toBe("role-emp");
      expect(rolesRepository.delete).toHaveBeenCalledWith("role-emp");
    });

    it("allows deleting a custom role even when it grants admin:manage", async () => {
      (rolesRepository.findById as Mock).mockResolvedValue({
        id: "role-it",
        name: "Information Technology",
        isSystem: false,
        rolePermissions: [{ permissionCode: "admin:manage" }],
      });
      (rolesRepository.delete as Mock).mockResolvedValue(undefined);

      const result = await rolesService.remove("role-it");

      expect(result.data.id).toBe("role-it");
      expect(rolesRepository.delete).toHaveBeenCalledWith("role-it");
    });
  });
});
