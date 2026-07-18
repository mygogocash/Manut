import type { PrismaClient } from "@manut/database";

import type { FileUploadLookup } from "./trusted-storage";

export function createPrismaFileUploadLookup(
  client: PrismaClient,
): FileUploadLookup {
  return {
    async findRegistered(query) {
      const upload = await client.fileUpload.findFirst({
        where: {
          bucket: query.bucket,
          path: query.path,
          purpose: query.purpose,
          ...(query.uploadedBy !== undefined && {
            uploadedBy: query.uploadedBy,
          }),
          ...(query.linkedTo !== undefined && { linkedTo: query.linkedTo }),
          ...(query.linkedId !== undefined && { linkedId: query.linkedId }),
        },
        select: { id: true },
      });
      return upload;
    },
  };
}
