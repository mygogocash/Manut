import { Prisma } from "@manut/database";

import {
  BadRequestException,
  ConflictException,
} from "@/common/exceptions/http-exception";
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

const SIGNATURE_INVITE_CLAIM_LEASE_MS = 5 * 60 * 1000;

type CreateSignatureForBatchInput = Omit<
  Prisma.LegalSignatureUncheckedCreateInput,
  | "batchId"
  | "documentId"
  | "documentSnapshotBucket"
  | "documentSnapshotFileName"
  | "documentSnapshotKind"
  | "documentSnapshotMimeType"
  | "documentSnapshotPath"
  | "documentSnapshotSha256"
  | "documentSnapshotSize"
  | "documentSnapshotTitle"
  | "documentSnapshotUploadId"
>;

type SignatureTransitionInput = Omit<
  Prisma.LegalSignatureUncheckedUpdateManyInput,
  | "batchId"
  | "documentId"
  | "documentSnapshotBucket"
  | "documentSnapshotFileName"
  | "documentSnapshotKind"
  | "documentSnapshotMimeType"
  | "documentSnapshotPath"
  | "documentSnapshotSha256"
  | "documentSnapshotSize"
  | "documentSnapshotTitle"
  | "documentSnapshotUploadId"
>;

export interface LegalSigningArtifactSnapshot {
  bucket: string;
  path: string;
  sha256: string;
  size: number;
  mimeType: string;
  fileName: string;
  title: string;
  kind: string;
  sourceFileUrl: string;
  sourceFileName: string | null;
  uploadId: string;
}

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

  async updateBeforeSigning(
    id: string,
    data: Prisma.LegalDocumentUncheckedUpdateInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM legal_documents
        WHERE id = ${id}::uuid
        FOR UPDATE
      `);
      if (!rows[0]) return undefined;
      const signatures = await tx.legalSignature.count({
        where: { documentId: id },
      });
      if (signatures > 0) return null;
      return tx.legalDocument.update({
        where: { id },
        data,
        include: documentInclude,
      });
    });
  }

  async removeBeforeSigning(id: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM legal_documents
        WHERE id = ${id}::uuid
        FOR UPDATE
      `);
      if (!rows[0]) return false;
      const signatures = await tx.legalSignature.count({
        where: { documentId: id },
      });
      if (signatures > 0) return false;
      await tx.legalDocument.delete({ where: { id } });
      return true;
    });
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

  async createSignatures(
    documentId: string,
    batchId: string,
    artifact: LegalSigningArtifactSnapshot,
    data: CreateSignatureForBatchInput[],
  ) {
    if (data.length === 0) {
      throw new BadRequestException("At least one signer is required");
    }

    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          currentSigningBatchId: string | null;
          fileName: string | null;
          fileUrl: string | null;
          kind: string;
          status: string;
          title: string;
        }>
      >(Prisma.sql`
        SELECT
          status,
          title,
          kind,
          file_url AS "fileUrl",
          file_name AS "fileName",
          current_signing_batch_id AS "currentSigningBatchId"
        FROM legal_documents
        WHERE id = ${documentId}::uuid
        FOR UPDATE
      `);
      if (!rows[0] || !["active", "draft"].includes(rows[0].status)) {
        return null;
      }
      if (
        rows[0].fileUrl !== artifact.sourceFileUrl ||
        rows[0].fileName !== artifact.sourceFileName ||
        rows[0].title !== artifact.title ||
        rows[0].kind !== artifact.kind
      ) {
        return null;
      }
      const sourceUploads = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT id
          FROM file_uploads
          WHERE id = ${artifact.uploadId}::uuid
            AND bucket = ${artifact.bucket}
            AND path = ${artifact.path}
          FOR KEY SHARE
        `,
      );
      if (!sourceUploads[0]) return null;
      const activeBatchRows = await tx.legalSignature.findMany({
        where: {
          documentId,
          status: { in: ["pending", "sent", "viewed"] },
        },
        select: { batchId: true, id: true, sentAt: true, status: true },
      });
      if (activeBatchRows.length > 0) {
        const currentBatchId = rows[0].currentSigningBatchId;
        if (
          !currentBatchId ||
          activeBatchRows.some(
            (signature) => signature.batchId !== currentBatchId,
          )
        ) {
          return null;
        }
        const currentBatchRows = await tx.legalSignature.findMany({
          where: { documentId, batchId: currentBatchId },
          select: { createdAt: true, id: true, sentAt: true, status: true },
        });
        const staleBefore = new Date(
          Date.now() - SIGNATURE_INVITE_CLAIM_LEASE_MS,
        );
        const isRecoverableAbandonedBatch =
          currentBatchRows.length > 0 &&
          currentBatchRows.every(
            (signature) =>
              signature.status === "pending" &&
              (signature.sentAt
                ? signature.sentAt < staleBefore
                : signature.createdAt < staleBefore),
          );
        if (!isRecoverableAbandonedBatch) return null;
        const cancelled = await tx.legalSignature.updateMany({
          where: {
            documentId,
            batchId: currentBatchId,
            status: "pending",
            OR: [
              { sentAt: { lt: staleBefore } },
              { sentAt: null, createdAt: { lt: staleBefore } },
            ],
          },
          data: { status: "cancelled" },
        });
        if (cancelled.count !== currentBatchRows.length) {
          throw new ConflictException(
            "The existing signing workflow changed; retry the request",
          );
        }
      }
      await tx.legalDocument.update({
        where: { id: documentId },
        data: { currentSigningBatchId: batchId },
      });
      return Promise.all(
        data.map((signature) =>
          tx.legalSignature.create({
            data: {
              ...signature,
              batchId,
              documentId,
              documentSnapshotBucket: artifact.bucket,
              documentSnapshotPath: artifact.path,
              documentSnapshotUploadId: artifact.uploadId,
              documentSnapshotSha256: artifact.sha256,
              documentSnapshotSize: artifact.size,
              documentSnapshotMimeType: artifact.mimeType,
              documentSnapshotFileName: artifact.fileName,
              documentSnapshotTitle: artifact.title,
              documentSnapshotKind: artifact.kind,
            },
            include: signatureDocumentInclude,
          }),
        ),
      );
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

  async findSignaturesByDocument(documentId: string, batchId?: string) {
    return prisma.legalSignature.findMany({
      where: { documentId, ...(batchId ? { batchId } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  async findLegalUploadByPath(
    bucket: string,
    path: string,
    purpose: "legal-document" | "legal-document-attachment",
  ) {
    return prisma.fileUpload.findFirst({
      where: { bucket, path, purpose },
      select: {
        id: true,
        mimeType: true,
        originalName: true,
        size: true,
      },
    });
  }

  async transitionSignature(
    id: string,
    fromStatuses: string[],
    data: SignatureTransitionInput,
  ) {
    const result = await prisma.legalSignature.updateMany({
      where: { id, status: { in: fromStatuses } },
      data,
    });
    if (result.count !== 1) return null;
    return this.findSignatureById(id);
  }

  async claimSignatureInvite(id: string, sentAt: Date): Promise<boolean> {
    const staleBefore = new Date(
      sentAt.getTime() - SIGNATURE_INVITE_CLAIM_LEASE_MS,
    );
    const result = await prisma.legalSignature.updateMany({
      where: {
        id,
        status: "pending",
        OR: [{ sentAt: null }, { sentAt: { lt: staleBefore } }],
      },
      data: { sentAt },
    });
    return result.count === 1;
  }

  async activateSignatureInvite(id: string, claimedAt: Date) {
    const result = await prisma.legalSignature.updateMany({
      where: { id, status: "pending", sentAt: claimedAt },
      data: { status: "sent" },
    });
    if (result.count !== 1) return null;
    return this.findSignatureById(id);
  }

  async releaseSignatureInvite(id: string, claimedAt: Date): Promise<boolean> {
    const result = await prisma.legalSignature.updateMany({
      where: { id, status: "pending", sentAt: claimedAt },
      data: { sentAt: null },
    });
    return result.count === 1;
  }

  async cancelSignatureBatch(
    documentId: string,
    batchId: string,
  ): Promise<number> {
    const result = await prisma.legalSignature.updateMany({
      where: {
        documentId,
        batchId,
        status: { in: ["pending", "sent", "viewed"] },
      },
      data: { status: "cancelled" },
    });
    return result.count;
  }

  async markDocumentSignedIfSignable(
    id: string,
    batchId: string,
  ): Promise<boolean> {
    const result = await prisma.legalDocument.updateMany({
      where: {
        id,
        currentSigningBatchId: batchId,
        status: { in: ["active", "draft"] },
      },
      data: { status: "signed" },
    });
    return result.count === 1;
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
