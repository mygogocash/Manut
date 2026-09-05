import type { JsonValue } from "@nexora/database";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { adminRepository } from "@/modules/admin/admin.repository";
import type {
  CreateDepartmentInput,
  CreateUserGroupInput,
  ManageGroupMembersInput,
  UpdateDepartmentInput,
  UpdateModuleAccessInput,
  UpdateSettingsInput,
  UpdateUserGroupInput,
} from "@/modules/admin/admin.validation";
import { isAdminSettingKey } from "@/modules/admin/admin.validation";

export const adminService = {
  async listAuditLogs(
    page: number,
    limit: number,
    filters?: { resource?: string; userId?: string; action?: string },
  ) {
    const { data, total } = await adminRepository.findAuditLogs(
      page,
      limit,
      filters,
    );
    return {
      data: data.map((log) => {
        const { timestamp, ...rest } = log;
        return { ...rest, createdAt: timestamp.toISOString() };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async listEntities() {
    const entities = await prisma.entity.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        country: true,
        currency: true,
      },
      orderBy: { name: "asc" },
    });
    return { data: entities };
  },

  async getSettings() {
    const settings = await adminRepository.findAllSettings();
    const result: Record<string, JsonValue> = {};
    for (const s of settings) {
      // Only what this endpoint can also WRITE. The table is shared, so an
      // unfiltered read handed the Settings screen the company bank account and
      // every notification distribution list — which it then rendered as text
      // inputs and posted straight back, stringifying them. Filtering the read
      // keeps the screen's contents and its capabilities the same set.
      if (isAdminSettingKey(s.key)) result[s.key] = s.value;
    }
    return result;
  },

  async updateSettings(input: UpdateSettingsInput) {
    const mapped = input.settings.map((s) => ({
      key: s.key,
      value: s.value as JsonValue,
    }));
    await adminRepository.upsertSettings(mapped);
    return this.getSettings();
  },

  async getModuleAccess(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    const access = await adminRepository.findModuleAccessByUser(userId);
    return { data: access };
  },

  async updateModuleAccess(input: UpdateModuleAccessInput, actorId: string) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) throw new NotFoundException("User not found");

    await adminRepository.upsertModuleAccess(
      input.userId,
      input.modules as { moduleId: string; granted: boolean }[],
      actorId,
    );

    const updated = await adminRepository.findModuleAccessByUser(input.userId);
    return { data: updated };
  },

  // ── User Groups ──

  async listUserGroups() {
    const groups = await adminRepository.findUserGroups();
    return { data: groups };
  },

  async getUserGroup(id: string) {
    const group = await adminRepository.findUserGroupById(id);
    if (!group) throw new NotFoundException("User group not found");
    return group;
  },

  async createUserGroup(input: CreateUserGroupInput, createdBy: string) {
    return adminRepository.createUserGroup({
      name: input.name,
      description: input.description,
      createdBy,
    });
  },

  async updateUserGroup(id: string, input: UpdateUserGroupInput) {
    const existing = await adminRepository.findUserGroupById(id);
    if (!existing) throw new NotFoundException("User group not found");
    return adminRepository.updateUserGroup(id, input);
  },

  async deleteUserGroup(id: string) {
    const existing = await adminRepository.findUserGroupById(id);
    if (!existing) throw new NotFoundException("User group not found");
    return adminRepository.deleteUserGroup(id);
  },

  async addGroupMembers(
    groupId: string,
    input: ManageGroupMembersInput,
    addedBy: string,
  ) {
    const group = await adminRepository.findUserGroupById(groupId);
    if (!group) throw new NotFoundException("User group not found");
    await adminRepository.addGroupMembers(groupId, input.userIds, addedBy);
    return adminRepository.findUserGroupById(groupId);
  },

  async removeGroupMembers(groupId: string, input: ManageGroupMembersInput) {
    const group = await adminRepository.findUserGroupById(groupId);
    if (!group) throw new NotFoundException("User group not found");
    await adminRepository.removeGroupMembers(groupId, input.userIds);
    return adminRepository.findUserGroupById(groupId);
  },

  // ── Departments (Form Configuration) ──

  async listDepartments() {
    const data = await prisma.department.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { data };
  },

  async createDepartment(input: CreateDepartmentInput) {
    const data = await prisma.department.create({
      data: {
        name: input.name,
        code: input.code || null,
        description: input.description || null,
      },
    });
    return { data };
  },

  async updateDepartment(id: string, input: UpdateDepartmentInput) {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Department not found");
    // The master row's name is the canonical label every dropdown
    // shows; when the admin renames it, the user-table's stringly
    // `department` columns keep the old value until they edit the
    // user record. The rename is purely a label change here — the
    // sweep across data columns (see 20260920000000 migration) ran
    // once at rollout and isn't re-applied on every label edit.
    const data = await prisma.department.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.code !== undefined && { code: input.code || null }),
        ...(input.description !== undefined && {
          description: input.description || null,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return { data };
  },

  async deleteDepartment(id: string) {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Department not found");
    // Soft-delete by flipping `isActive` rather than hard-removing
    // the row — existing user.department / project.department
    // strings still need to resolve against the canonical list, and
    // a dropped name would render those rows as "unknown
    // department" until the admin re-edits each one.
    const data = await prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
    return { data };
  },
};
