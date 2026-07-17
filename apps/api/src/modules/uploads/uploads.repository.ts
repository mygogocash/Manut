import { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

export const MODULE_CONTROLLED_UPLOAD_PURPOSES = [
  "payslip-document",
  "cash-advance-disbursement-proof",
] as const;

export function isModuleControlledUploadPurpose(
  purpose: string | null | undefined,
): boolean {
  return (
    purpose !== null &&
    purpose !== undefined &&
    MODULE_CONTROLLED_UPLOAD_PURPOSES.includes(
      purpose as (typeof MODULE_CONTROLLED_UPLOAD_PURPOSES)[number],
    )
  );
}

export const uploadsRepository = {
  async findAll(userId: string, page: number, limit: number) {
    const where = {
      uploadedBy: userId,
      OR: [
        { purpose: null },
        { purpose: { notIn: [...MODULE_CONTROLLED_UPLOAD_PURPOSES] } },
      ],
    };
    const [data, total] = await Promise.all([
      prisma.fileUpload.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.fileUpload.count({ where }),
    ]);
    return { data, total };
  },

  async findById(id: string) {
    return prisma.fileUpload.findUnique({ where: { id } });
  },

  async create(data: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    bucket?: string;
    uploadedBy: string;
    purpose?: string;
    linkedTo?: string;
    linkedId?: string;
  }) {
    return prisma.fileUpload.create({ data });
  },

  async removeOwnedIfUnreferenced(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          bucket: string | null;
          path: string;
          purpose: string | null;
          uploadedBy: string;
        }>
      >(Prisma.sql`
        SELECT
          bucket,
          path,
          purpose,
          uploaded_by AS "uploadedBy"
        FROM file_uploads
        WHERE id = ${id}::uuid
        FOR UPDATE
      `);
      const upload = rows[0];
      if (!upload) return { status: "missing" } as const;
      if (upload.uploadedBy !== userId) return { status: "forbidden" } as const;
      if (isModuleControlledUploadPurpose(upload.purpose)) {
        return { status: "protected" } as const;
      }

      const [legalReferences, cashProofReferences] = await Promise.all([
        tx.legalSignature.count({
          where: { documentSnapshotUploadId: id },
        }),
        tx.cashAdvanceRequest.count({
          where: { disbursementProofUploadId: id },
        }),
      ]);
      if (legalReferences > 0 || cashProofReferences > 0) {
        return { status: "protected" } as const;
      }

      await tx.fileUpload.delete({ where: { id } });
      return {
        status: "deleted",
        bucket: upload.bucket || "uploads",
        path: upload.path,
      } as const;
    });
  },

  async linkToMessage(uploadIds: string[], messageId: string, ownerId: string) {
    if (uploadIds.length === 0) return [];
    const relinkableWhere = {
      id: { in: uploadIds },
      uploadedBy: ownerId,
      OR: [
        { purpose: null },
        { purpose: { notIn: [...MODULE_CONTROLLED_UPLOAD_PURPOSES] } },
      ],
    };
    await prisma.fileUpload.updateMany({
      where: relinkableWhere,
      data: { linkedTo: "message", linkedId: messageId },
    });
    return prisma.fileUpload.findMany({
      where: {
        ...relinkableWhere,
        linkedTo: "message",
        linkedId: messageId,
      },
    });
  },
};
