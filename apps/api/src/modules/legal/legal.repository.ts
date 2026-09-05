import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const attachmentUploaderSelect = {
  id: true,
  name: true,
  email: true,
} as const;

const shareInclude = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  group: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

const documentInclude = {
  owner: { select: { id: true, name: true, email: true } },
  entity: { select: { id: true, name: true } },
  attachments: {
    orderBy: { createdAt: "asc" },
    include: {
      uploadedBy: { select: attachmentUploaderSelect },
    },
  },
  shares: {
    orderBy: { createdAt: "asc" },
    include: shareInclude,
  },
} satisfies Prisma.LegalDocumentInclude;

// Public signing pages need just enough doc info to render the file —
// notes and parties are deliberately excluded so we don't leak internal
// commentary to an external signer who only has the token.
const signatureDocumentInclude = {
  document: {
    select: {
      id: true,
      title: true,
      kind: true,
      fileUrl: true,
      fileName: true,
      status: true,
    },
  },
} satisfies Prisma.LegalSignatureInclude;

export interface FindManyFilters {
  kind?: string;
  status?: string;
  entityId?: string;
  ownerId?: string;
  folder?: string;
  search?: string;
  expiringWithinDays?: number;
  // When set, scope results to docs the user can see WITHOUT
  // `legal:read` — visibility=public + per-user / per-department /
  // per-group shares. Used by the "Shared with me" employee view.
  visibleToUser?: {
    userId: string;
    department: string | null;
    groupIds: string[];
  };
}

export class LegalRepository {
  async findMany(filters: FindManyFilters, page: number, limit: number) {
    const where: Prisma.LegalDocumentWhereInput = {};
    if (filters.kind) where.kind = filters.kind;
    if (filters.status) where.status = filters.status;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    // Sentinel "__none__" surfaces only un-foldered rows.
    if (filters.folder === "__none__") {
      where.folder = null;
    } else if (filters.folder) {
      where.folder = filters.folder;
    }
    if (filters.search) {
      const term = filters.search;
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { reference: { contains: term, mode: "insensitive" } },
        { parties: { has: term } },
      ];
    }
    if (filters.expiringWithinDays !== undefined) {
      const today = startOfDayUTC(new Date());
      const horizon = startOfDayUTC(
        new Date(today.getTime() + filters.expiringWithinDays * 86_400_000),
      );
      where.expiryDate = { gte: today, lte: horizon };
    }

    if (filters.visibleToUser) {
      const v = filters.visibleToUser;
      // Public + owner + per-user share + per-department share + per-
      // group share. We always include archived/non-archived in this
      // path — recipients see whatever state legal put the row in.
      where.AND = [
        ...(where.AND
          ? Array.isArray(where.AND)
            ? where.AND
            : [where.AND]
          : []),
        {
          OR: [
            { visibility: "public" },
            { ownerId: v.userId },
            {
              shares: {
                some: {
                  OR: [
                    { type: "user", userId: v.userId },
                    ...(v.department
                      ? [{ type: "department", department: v.department }]
                      : []),
                    ...(v.groupIds.length > 0
                      ? [{ type: "group", groupId: { in: v.groupIds } }]
                      : []),
                  ],
                },
              },
            },
          ],
        },
      ];
    }

    const [data, total] = await prisma.$transaction([
      prisma.legalDocument.findMany({
        where,
        include: documentInclude,
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.legalDocument.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.legalDocument.findUnique({
      where: { id },
      include: documentInclude,
    });
  }

  async create(data: Prisma.LegalDocumentUncheckedCreateInput) {
    return prisma.legalDocument.create({ data, include: documentInclude });
  }

  async update(id: string, data: Prisma.LegalDocumentUncheckedUpdateInput) {
    return prisma.legalDocument.update({
      where: { id },
      data,
      include: documentInclude,
    });
  }

  async remove(id: string) {
    return prisma.legalDocument.delete({ where: { id } });
  }

  async stats() {
    const today = startOfDayUTC(new Date());
    const in30 = startOfDayUTC(new Date(today.getTime() + 30 * 86_400_000));

    // Stats use *effective* expiry (max of parent + attachment expiries)
    // so a freshly uploaded addendum keeps the parent out of the expired
    // bucket even if the original expiryDate is past.
    const [total, archived, allDocs, effectiveBuckets] = await Promise.all([
      prisma.legalDocument.count(),
      prisma.legalDocument.count({ where: { status: "archived" } }),
      prisma.legalDocument.findMany({ select: { kind: true, status: true } }),
      prisma.$queryRaw<Array<{ effective_expiry: Date | null }>>`
        SELECT GREATEST(
          d.expiry_date,
          (
            SELECT MAX(a.expiry_date) FROM legal_document_attachments a
            WHERE a.document_id = d.id
          )
        ) AS effective_expiry
        FROM legal_documents d
        WHERE d.status = 'active'
      `,
    ]);

    let expiringSoon = 0;
    let expired = 0;
    for (const row of effectiveBuckets) {
      const eff = row.effective_expiry;
      if (!eff) continue;
      if (eff < today) expired += 1;
      else if (eff <= in30) expiringSoon += 1;
    }

    const byKind: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const row of allDocs) {
      byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    }

    return { total, expiringSoon, expired, archived, byKind, byStatus };
  }

  // Distinct folder labels with counts. Includes a synthetic
  // "__none__" entry for rows whose folder is null so the UI can
  // surface an "Ungrouped" bucket without a second round-trip.
  async findFolders() {
    const grouped = await prisma.legalDocument.groupBy({
      by: ["folder"],
      _count: { id: true },
      orderBy: { folder: "asc" },
    });
    return grouped.map((row) => ({
      name: row.folder,
      count: row._count.id,
    }));
  }

  // ── Phase 2 signing flow ────────────────────────────────────────────────

  async createSignature(data: Prisma.LegalSignatureUncheckedCreateInput) {
    return prisma.legalSignature.create({
      data,
      include: signatureDocumentInclude,
    });
  }

  async findSignatureById(id: string) {
    return prisma.legalSignature.findUnique({
      where: { id },
      include: signatureDocumentInclude,
    });
  }

  async findSignatureByToken(token: string) {
    return prisma.legalSignature.findUnique({
      where: { token },
      include: signatureDocumentInclude,
    });
  }

  async findSignaturesByDocument(documentId: string) {
    return prisma.legalSignature.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateSignature(
    id: string,
    data: Prisma.LegalSignatureUncheckedUpdateInput,
  ) {
    return prisma.legalSignature.update({
      where: { id },
      data,
      include: signatureDocumentInclude,
    });
  }

  async cancelSignature(id: string) {
    return prisma.legalSignature.update({
      where: { id },
      data: { status: "cancelled" },
      include: signatureDocumentInclude,
    });
  }

  // ── Attachments ────────────────────────────────────────────────────────

  async createAttachment(
    data: Prisma.LegalDocumentAttachmentUncheckedCreateInput,
  ) {
    return prisma.legalDocumentAttachment.create({
      data,
      include: { uploadedBy: { select: attachmentUploaderSelect } },
    });
  }

  async findAttachmentById(id: string) {
    return prisma.legalDocumentAttachment.findUnique({
      where: { id },
      include: { uploadedBy: { select: attachmentUploaderSelect } },
    });
  }

  async updateAttachment(
    id: string,
    data: Prisma.LegalDocumentAttachmentUncheckedUpdateInput,
  ) {
    return prisma.legalDocumentAttachment.update({
      where: { id },
      data,
      include: { uploadedBy: { select: attachmentUploaderSelect } },
    });
  }

  async removeAttachment(id: string) {
    return prisma.legalDocumentAttachment.delete({ where: { id } });
  }

  // ── Shares ─────────────────────────────────────────────────────────────

  async createShare(data: Prisma.LegalDocumentShareUncheckedCreateInput) {
    return prisma.legalDocumentShare.create({
      data,
      include: shareInclude,
    });
  }

  async findShareById(id: string) {
    return prisma.legalDocumentShare.findUnique({
      where: { id },
      include: shareInclude,
    });
  }

  async findSharesByDocument(documentId: string) {
    return prisma.legalDocumentShare.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
      include: shareInclude,
    });
  }

  async removeShare(id: string) {
    return prisma.legalDocumentShare.delete({ where: { id } });
  }

  async updateVisibility(documentId: string, visibility: string) {
    return prisma.legalDocument.update({
      where: { id: documentId },
      data: { visibility },
      include: documentInclude,
    });
  }

  // Memberships used by the visibility filter — resolves the user's
  // department + active group ids once per request.
  // Picker options for the share dialog. Returns distinct
  // departments (non-null, non-empty) + every active user group.
  async findShareOptions() {
    const [users, groups] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true, department: { not: null } },
        select: { department: true },
        distinct: ["department"],
      }),
      prisma.userGroup.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const departments = users
      .map((u) => u.department)
      .filter((d): d is string => !!d && d.trim() !== "")
      .sort((a, b) => a.localeCompare(b));
    return { departments, groups };
  }

  async findUserVisibilityContext(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        department: true,
        userGroupMemberships: {
          where: { group: { isActive: true } },
          select: { groupId: true },
        },
      },
    });
    return {
      userId,
      department: user?.department ?? null,
      groupIds: (user?.userGroupMemberships ?? []).map((g) => g.groupId),
    };
  }

  // Active docs whose *effective* expiry (max of doc.expiryDate and any
  // attachment.expiryDate) falls within `withinDays` from today. The
  // query unions per-doc max-expiry across the parent + its attachments
  // and filters in SQL so the cron digest doesn't have to fan-out.
  async findExpiringSoonWithEffective(withinDays: number) {
    const today = startOfDayUTC(new Date());
    const horizon = startOfDayUTC(
      new Date(today.getTime() + withinDays * 86_400_000),
    );

    const rows = await prisma.$queryRaw<
      Array<{ id: string; effective_expiry: Date | null }>
    >`
      SELECT d.id,
             GREATEST(
               COALESCE(d.expiry_date, '1900-01-01'::date),
               COALESCE((
                 SELECT MAX(a.expiry_date) FROM legal_document_attachments a
                 WHERE a.document_id = d.id
               ), '1900-01-01'::date)
             ) AS effective_expiry
      FROM legal_documents d
      WHERE d.status = 'active'
        AND (
          d.expiry_date BETWEEN ${today} AND ${horizon}
          OR EXISTS (
            SELECT 1 FROM legal_document_attachments a
            WHERE a.document_id = d.id
              AND a.expiry_date BETWEEN ${today} AND ${horizon}
          )
        )
    `;

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const docs = await prisma.legalDocument.findMany({
      where: { id: { in: ids } },
      include: documentInclude,
    });
    // Only surface docs whose *effective* expiry is inside the window;
    // a fresh addendum that extends past the horizon should drop the
    // parent from the alert list.
    const effectiveById = new Map(rows.map((r) => [r.id, r.effective_expiry]));
    return docs.filter((d) => {
      const eff = effectiveById.get(d.id);
      if (!eff) return false;
      return eff >= today && eff <= horizon;
    });
  }

  // ── Notification settings (singleton) ────────────────────────
  async getNotificationSettings() {
    const row = await prisma.legalNotificationSettings.findFirst({
      where: { singleton: true },
    });
    if (row) return row;
    return prisma.legalNotificationSettings.create({
      data: { singleton: true, recipients: [] },
    });
  }

  async updateNotificationSettings(
    data: Prisma.LegalNotificationSettingsUncheckedUpdateInput,
  ) {
    await this.getNotificationSettings(); // ensure the singleton exists
    return prisma.legalNotificationSettings.update({
      where: { singleton: true },
      data,
    });
  }
}

function startOfDayUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export const legalRepository = new LegalRepository();
