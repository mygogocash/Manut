import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import {
  createSignedUrl,
  requireRegisteredStorageUrl,
  STORAGE_BUCKETS,
} from "@/infrastructure/storage/supabase-storage";
import { legalAnnouncementRepository } from "@/modules/legal-announcements/legal-announcements.repository";
import type {
  AnnouncementQuery,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "@/modules/legal-announcements/legal-announcements.validation";

// Zod's output for `attachmentInputSchema` widens both fields to
// `string | undefined` even though the schema requires them. Drop
// rows with missing values and assert the rest as concrete strings
// so the repository's `Array<{ fileUrl: string; fileName: string }>`
// signature accepts the payload.
function normaliseAttachments(
  attachments:
    | ReadonlyArray<{
        fileUrl?: string;
        fileName?: string;
      }>
    | undefined,
): Array<{ fileUrl: string; fileName: string }> | undefined {
  if (!attachments) return undefined;
  const out: Array<{ fileUrl: string; fileName: string }> = [];
  for (const a of attachments) {
    if (!a.fileUrl || !a.fileName) continue;
    out.push({ fileUrl: a.fileUrl, fileName: a.fileName });
  }
  return out;
}

async function validateAttachments(
  attachments: ReturnType<typeof normaliseAttachments>,
  actorId: string,
  existingUrls: ReadonlySet<string> = new Set(),
) {
  if (!attachments) return attachments;
  await Promise.all(
    attachments.map((attachment) =>
      requireRegisteredStorageUrl(attachment.fileUrl, {
        allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
        purpose: "legal-announcement",
        ...(!existingUrls.has(attachment.fileUrl) && { uploadedBy: actorId }),
      }),
    ),
  );
  return attachments;
}

function assertAnnouncementVisible(
  announcement: {
    status: string;
    entityId: string | null;
    publishedAt: Date | null;
    expiresAt: Date | null;
  },
  userEntityId: string | null,
  canManage: boolean,
): void {
  if (canManage) return;
  const now = new Date();
  const isPublished = announcement.status === "published";
  const hasStarted =
    announcement.publishedAt === null || announcement.publishedAt <= now;
  const hasNotExpired =
    announcement.expiresAt === null || announcement.expiresAt >= now;
  const isInEntityScope =
    announcement.entityId === null || announcement.entityId === userEntityId;
  if (!isPublished || !hasStarted || !hasNotExpired || !isInEntityScope) {
    throw new NotFoundException("Announcement not found");
  }
}

export class LegalAnnouncementService {
  async list(
    userId: string,
    userEntityId: string | null,
    canManage: boolean,
    query: AnnouncementQuery,
  ) {
    // Non-manage users are pinned to the employee view regardless of
    // what they pass — keeps draft / archived rows out of their eye.
    const scope = canManage ? query.scope : "mine";
    const { page, limit, ...filters } = query;
    const { data, total } = await legalAnnouncementRepository.findMany(
      {
        ...filters,
        scope,
        userEntityId,
        userId,
      },
      page,
      limit,
    );
    return {
      data: data.map((row) => serialize(row, userId)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(
    id: string,
    userId: string,
    userEntityId: string | null,
    canManage: boolean,
  ) {
    const row = await legalAnnouncementRepository.findById(id, userId);
    if (!row) throw new NotFoundException("Announcement not found");
    assertAnnouncementVisible(row, userEntityId, canManage);
    return { data: serialize(row, userId) };
  }

  async create(input: CreateAnnouncementInput, authorId: string) {
    const attachments = await validateAttachments(
      normaliseAttachments(input.attachments),
      authorId,
    );
    const row = await legalAnnouncementRepository.create({
      title: input.title,
      body: input.body,
      kind: input.kind,
      entityId: input.entityId,
      status: input.status,
      publishedAt:
        input.status === "published" && !input.publishedAt
          ? new Date()
          : input.publishedAt
            ? new Date(input.publishedAt)
            : undefined,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      requiresAck: input.requiresAck,
      pinned: input.pinned,
      authorId,
      attachments,
    });
    return { data: serialize(row, authorId) };
  }

  async update(id: string, input: UpdateAnnouncementInput, userId: string) {
    const existing = await legalAnnouncementRepository.findById(id);
    if (!existing) throw new NotFoundException("Announcement not found");
    const existingAttachmentUrls = new Set(
      existing.attachments.map((attachment) => attachment.fileUrl),
    );
    const attachments = await validateAttachments(
      normaliseAttachments(input.attachments),
      userId,
      existingAttachmentUrls,
    );

    // Auto-stamp publishedAt the first time a draft flips to published
    // unless the caller passed one explicitly.
    let publishedAt: Date | null | undefined;
    if (input.publishedAt === null) {
      publishedAt = null;
    } else if (input.publishedAt) {
      publishedAt = new Date(input.publishedAt);
    } else if (
      input.status === "published" &&
      existing.status !== "published" &&
      !existing.publishedAt
    ) {
      publishedAt = new Date();
    }

    const row = await legalAnnouncementRepository.update(id, {
      title: input.title,
      body: input.body,
      kind: input.kind,
      entityId:
        input.entityId === null
          ? null
          : input.entityId
            ? input.entityId
            : undefined,
      status: input.status,
      publishedAt,
      expiresAt:
        input.expiresAt === null
          ? null
          : input.expiresAt
            ? new Date(input.expiresAt)
            : undefined,
      requiresAck: input.requiresAck,
      pinned: input.pinned,
      attachments,
    });
    return { data: serialize(row, userId) };
  }

  async remove(id: string) {
    const existing = await legalAnnouncementRepository.findById(id);
    if (!existing) throw new NotFoundException("Announcement not found");
    await legalAnnouncementRepository.remove(id);
    return { data: { id } };
  }

  async acknowledge(
    id: string,
    userId: string,
    userEntityId: string | null,
    canManage: boolean,
    ip: string | null,
  ) {
    const row = await legalAnnouncementRepository.findById(id);
    if (!row) throw new NotFoundException("Announcement not found");
    assertAnnouncementVisible(row, userEntityId, canManage);
    if (row.status !== "published") {
      throw new BadRequestException(
        "Only published announcements can be acknowledged",
      );
    }
    // Ack rows are upserted so calling /ack twice is a no-op rather
    // than a unique-constraint error.
    await legalAnnouncementRepository.ack(id, userId, ip);
    const refreshed = await legalAnnouncementRepository.findById(id, userId);
    return { data: refreshed ? serialize(refreshed, userId) : null };
  }

  async listAckers(id: string, canManage: boolean) {
    if (!canManage) {
      throw new ForbiddenException("Only managers can view the ack list");
    }
    const acks = await legalAnnouncementRepository.listAckers(id);
    return {
      data: acks.map((a) => ({
        userId: a.userId,
        ackedAt: a.ackedAt.toISOString(),
        ackedIp: a.ackedIp,
        user: a.user
          ? {
              id: a.user.id,
              name: a.user.name,
              email: a.user.email,
              avatarUrl: a.user.avatarUrl,
              entity: a.user.entity,
            }
          : null,
      })),
    };
  }

  // Lightweight badge endpoint for the dashboard banner. Returns just
  // a count + the freshest unacked title so the UI can show "X new
  // announcements" without paging the full list.
  async unackedSummary(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { entityId: true },
    });
    const entityId = user?.entityId ?? null;
    const count = await legalAnnouncementRepository.countUnackedForUser(
      userId,
      entityId,
    );
    return { data: { count } };
  }

  // Mints a short-lived signed URL for an inline attachment. The
  // `documents` bucket is private, so the raw fileUrl 404s.
  async getAttachmentDownloadUrl(
    announcementId: string,
    attachmentId: string,
    userId: string,
    userEntityId: string | null,
    canManage: boolean,
  ) {
    await this.getById(announcementId, userId, userEntityId, canManage);
    const att = await prisma.legalAnnouncementAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!att || att.announcementId !== announcementId) {
      throw new NotFoundException("Attachment not found");
    }
    const parsed = await requireRegisteredStorageUrl(att.fileUrl, {
      allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
      purpose: "legal-announcement",
    });
    const url = await createSignedUrl(parsed.bucket, parsed.path, 300);
    return { data: { url, fileName: att.fileName } };
  }
}

interface SerializableRow {
  id: string;
  title: string;
  body: string;
  kind: string;
  entityId: string | null;
  status: string;
  publishedAt: Date | null;
  expiresAt: Date | null;
  requiresAck: boolean;
  pinned: boolean;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  entity: { id: string; name: string; code: string } | null;
  attachments: Array<{
    id: string;
    announcementId: string;
    fileUrl: string;
    fileName: string;
    uploadedAt: Date;
  }>;
  acks?: Array<{ userId: string; ackedAt: Date }>;
  _count?: { acks: number };
}

function serialize(row: SerializableRow, viewerId: string) {
  const myAck = row.acks?.find((a) => a.userId === viewerId) ?? null;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    entityId: row.entityId,
    entity: row.entity,
    status: row.status,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    requiresAck: row.requiresAck,
    pinned: row.pinned,
    authorId: row.authorId,
    author: row.author,
    attachments: row.attachments.map((a) => ({
      id: a.id,
      announcementId: a.announcementId,
      fileUrl: a.fileUrl,
      fileName: a.fileName,
      uploadedAt: a.uploadedAt.toISOString(),
    })),
    ackCount: row._count?.acks ?? 0,
    myAckedAt: myAck ? myAck.ackedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const legalAnnouncementService = new LegalAnnouncementService();
