import { normalizePermissionCodes } from "@/common/constants/permissions";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { rolesRepository } from "@/modules/roles/roles.repository";
import type {
  CloneRoleInput,
  CreateRoleInput,
  UpdateRoleInput,
} from "@/modules/roles/roles.validation";

export class RolesService {
  async list() {
    const roles = await rolesRepository.findAll();

    return {
      data: roles.map((r) => {
        const permissions = normalizePermissionCodes(
          r.rolePermissions.map((rp) => rp.permissionCode),
        );
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
          permissionCount: permissions.length,
          permissions,
          userCount: r._count.userRoles,
          createdAt: r.createdAt,
        };
      }),
    };
  }

  async getById(id: string) {
    const role = await rolesRepository.findById(id);
    if (!role) throw new NotFoundException("Role not found");

    return {
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: normalizePermissionCodes(
          role.rolePermissions.map((rp) => rp.permissionCode),
        ),
        userCount: role._count.userRoles,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
    };
  }

  async create(input: CreateRoleInput) {
    const existing = await rolesRepository.findByName(input.name);
    if (existing) throw new ConflictException("Role name already exists");

    const role = await rolesRepository.create({
      name: input.name,
      description: input.description,
      permissions: input.permissions,
    });

    return {
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: normalizePermissionCodes(
          role.rolePermissions.map((rp) => rp.permissionCode),
        ),
        userCount: role._count.userRoles,
      },
    };
  }

  async update(id: string, input: UpdateRoleInput) {
    const role = await rolesRepository.findById(id);
    if (!role) throw new NotFoundException("Role not found");

    if (role.isSystem && role.name === "Admin") {
      throw new BadRequestException(
        "Cannot modify the Admin role — it always has full permissions",
      );
    }

    if (input.name && input.name !== role.name) {
      const existing = await rolesRepository.findByName(input.name);
      if (existing) throw new ConflictException("Role name already exists");
    }

    const updated = await rolesRepository.update(id, {
      name: input.name,
      description: input.description,
      permissions: input.permissions,
      defaultRoute: input.defaultRoute,
    });

    return {
      data: {
        id: updated!.id,
        name: updated!.name,
        description: updated!.description,
        isSystem: updated!.isSystem,
        permissions: normalizePermissionCodes(
          updated!.rolePermissions.map((rp) => rp.permissionCode),
        ),
        userCount: updated!._count.userRoles,
      },
    };
  }

  async remove(id: string) {
    const role = await rolesRepository.findById(id);
    if (!role) throw new NotFoundException("Role not found");

    if (role.isSystem && role.name === "Admin") {
      throw new BadRequestException("Cannot delete the Admin role");
    }

    await rolesRepository.delete(id);
    return { data: { id } };
  }

  async listMembers(id: string) {
    const role = await rolesRepository.findById(id);
    if (!role) throw new NotFoundException("Role not found");
    const data = await rolesRepository.findMembers(id);
    return { data };
  }

  async clone(id: string, input: CloneRoleInput) {
    const source = await rolesRepository.findById(id);
    if (!source) throw new NotFoundException("Source role not found");

    const existing = await rolesRepository.findByName(input.name);
    if (existing) throw new ConflictException("Role name already exists");

    const permissions = source.rolePermissions.map((rp) => rp.permissionCode);

    const role = await rolesRepository.create({
      name: input.name,
      description: input.description ?? source.description ?? undefined,
      permissions,
    });

    return {
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: normalizePermissionCodes(
          role.rolePermissions.map((rp) => rp.permissionCode),
        ),
        userCount: role._count.userRoles,
        createdAt: role.createdAt,
      },
    };
  }
}

export const rolesService = new RolesService();
