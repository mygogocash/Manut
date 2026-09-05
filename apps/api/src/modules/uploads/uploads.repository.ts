import { prisma } from "@/infrastructure/database/prisma";

export const uploadsRepository = {
  async findAll(userId: string, page: number, limit: number) {
    const [data, total] = await Promise.all([
      prisma.fileUpload.findMany({
        where: { uploadedBy: userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.fileUpload.count({ where: { uploadedBy: userId } }),
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

  async remove(id: string) {
    return prisma.fileUpload.delete({ where: { id } });
  },

  async softRemove(id: string, deletedBy: string) {
    return prisma.fileUpload.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy },
    });
  },

  async linkToMessage(uploadIds: string[], messageId: string, ownerId: string) {
    if (uploadIds.length === 0) return [];
    await prisma.fileUpload.updateMany({
      where: { id: { in: uploadIds }, uploadedBy: ownerId },
      data: { linkedTo: "message", linkedId: messageId },
    });
    return prisma.fileUpload.findMany({
      where: { id: { in: uploadIds } },
    });
  },
};
