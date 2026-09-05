import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const ticketInclude = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      department: true,
      jobTitle: true,
    },
  },
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      department: true,
      jobTitle: true,
    },
  },
} satisfies Prisma.HelpdeskTicketInclude;

export type TicketWithPeople = Prisma.HelpdeskTicketGetPayload<{
  include: typeof ticketInclude;
}>;

export class HelpdeskRepository {
  list(args: {
    where: Prisma.HelpdeskTicketWhereInput;
    skip: number;
    take: number;
  }) {
    return prisma.helpdeskTicket.findMany({
      where: args.where,
      include: ticketInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: args.skip,
      take: args.take,
    });
  }

  count(where: Prisma.HelpdeskTicketWhereInput) {
    return prisma.helpdeskTicket.count({ where });
  }

  findById(id: string) {
    return prisma.helpdeskTicket.findUnique({
      where: { id },
      include: ticketInclude,
    });
  }

  create(data: Prisma.HelpdeskTicketUncheckedCreateInput) {
    return prisma.helpdeskTicket.create({
      data,
      include: ticketInclude,
    });
  }

  update(id: string, data: Prisma.HelpdeskTicketUncheckedUpdateInput) {
    return prisma.helpdeskTicket.update({
      where: { id },
      data,
      include: ticketInclude,
    });
  }

  delete(id: string) {
    return prisma.helpdeskTicket.delete({ where: { id } });
  }

  listComments(ticketId: string) {
    return prisma.helpdeskComment.findMany({
      where: { ticketId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Active users who hold any IT-team permission. Used to populate
   * the ticket Assignee dropdown. System Admins inherit every code
   * via the runtime `ALL_PERMISSION_CODES` bypass in
   * `auth.guard.ts`, so the lookup joins on `RolePermission` (the
   * explicit grants) AND the system Admin role to catch both paths.
   */
  async findAssignableUsers() {
    const IT_TEAM_CODES = ["it:assign", "it:resolve", "it:update"];
    return prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: {
              OR: [
                { isSystem: true, name: "Admin" },
                {
                  rolePermissions: {
                    some: { permissionCode: { in: IT_TEAM_CODES } },
                  },
                },
              ],
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        jobTitle: true,
      },
      orderBy: { name: "asc" },
    });
  }

  createComment(data: { ticketId: string; authorId: string; body: string }) {
    return prisma.helpdeskComment.create({
      data,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            jobTitle: true,
          },
        },
      },
    });
  }

  // Settings row is a singleton enforced by the unique `singleton`
  // column. The 0020 migration seeds it; this fetch never returns
  // null in production but stays defensive for fresh dev DBs.
  async getSettings() {
    const row = await prisma.helpdeskSettings.findFirst({
      where: { singleton: true },
    });
    if (row) return row;
    return prisma.helpdeskSettings.create({
      data: { singleton: true, notifyEmails: [] },
    });
  }

  async upsertSettings(
    data: {
      notifyEmails: string[];
      notifyOnCreate: boolean;
      notifyCreatorOnCreate: boolean;
      notifyCreatorOnStatus: boolean;
      // GitHub workflow fields — write-only on the FE; only the keys
      // the caller supplies are written, so blank token / secret leaves
      // the stored value untouched.
      githubEnabled?: boolean;
      githubRepoOwner?: string | null;
      githubRepoName?: string | null;
      githubTokenEncrypted?: string;
      githubWebhookSecret?: string;
      githubLabelInProgress?: string;
      githubLabelReview?: string;
    },
    updatedById: string,
  ) {
    return prisma.helpdeskSettings.upsert({
      where: { singleton: true },
      create: { singleton: true, ...data, updatedById },
      update: { ...data, updatedById },
    });
  }
}

export type CommentWithAuthor = Prisma.HelpdeskCommentGetPayload<{
  include: {
    author: {
      select: {
        id: true;
        name: true;
        email: true;
        avatarUrl: true;
        jobTitle: true;
      };
    };
  };
}>;

export const helpdeskRepository = new HelpdeskRepository();
