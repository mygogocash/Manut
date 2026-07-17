import { prisma } from "@/infrastructure/database/prisma";

export class RolesRepository {
  async findAll() {
    return prisma.role.findMany({
      include: {
        rolePermissions: { select: { permissionCode: true } },
        _count: { select: { userRoles: true } },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  async findById(id: string) {
    return prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: true,
        _count: { select: { userRoles: true } },
      },
    });
  }

  async findByName(name: string) {
    return prisma.role.findUnique({ where: { name } });
  }

  async create(data: {
    name: string;
    description?: string;
    permissions: string[];
  }) {
    return prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        rolePermissions: {
          createMany: {
            data: data.permissions.map((code) => ({ permissionCode: code })),
          },
        },
      },
      include: {
        rolePermissions: true,
        _count: { select: { userRoles: true } },
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      permissions?: string[];
      defaultRoute?: string | null;
    },
  ) {
    const { permissions, ...roleData } = data;

    return prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: roleData });

      if (permissions !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });

        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((code) => ({
              roleId: id,
              permissionCode: code,
            })),
          });
        }
      }

      return tx.role.findUnique({
        where: { id },
        include: {
          rolePermissions: true,
          _count: { select: { userRoles: true } },
        },
      });
    });
  }

  async delete(id: string) {
    return prisma.role.delete({ where: { id } });
  }

  /**
   * Active members of a role, sorted by name. Used by the Roles page
   * to expand "X users" into a list when the admin clicks View members.
   */
  async findMembers(roleId: string) {
    const memberships = await prisma.userRole.findMany({
      where: { roleId, user: { isActive: true } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            jobTitle: true,
            department: true,
            employeeId: true,
            entity: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    return memberships
      .map((m) => m.user)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }
}

export const rolesRepository = new RolesRepository();
