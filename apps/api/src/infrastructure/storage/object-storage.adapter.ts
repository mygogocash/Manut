import { NotFoundException } from "@/common/exceptions/http-exception";
import type {
  CreateUploadInput,
  FinalizeUploadInput,
  ObjectStoragePort,
  PendingUpload,
  StorageActor,
  StoredObject,
} from "@/ports/object-storage.port";

type UploadRecord = {
  id: string;
  path: string;
  bucket?: string | null;
  mimeType: string;
  size: number;
  originalName: string;
  uploadedBy?: string;
  url?: string;
};

type UploadsServiceLike = {
  upload(
    userId: string,
    input: {
      base64: string;
      originalName: string;
      mimeType: string;
      bucket?:
        | "article"
        | "avatars"
        | "blog"
        | "receipts"
        | "documents"
        | "uploads";
      purpose?: string;
      linkedTo?: string;
      linkedId?: string;
    },
  ): Promise<UploadRecord>;
  getSignedUrl(
    uploadId: string,
    userId: string,
  ): Promise<{ url: string }>;
  remove(uploadId: string, userId: string): Promise<void>;
};

type UploadsRepositoryLike = {
  findById(id: string): Promise<{
    id: string;
    uploadedBy: string;
    bucket: string | null;
    path: string;
    mimeType: string;
    size: number;
    originalName: string;
  } | null>;
};

export interface LegacyObjectStorageAdapterDeps {
  uploads: UploadsServiceLike;
  repository: UploadsRepositoryLike;
}

/**
 * Wraps the existing uploadsService / file_uploads path behind ObjectStoragePort.
 * No production call sites are migrated yet — this is the strangler boundary.
 */
export class LegacyObjectStorageAdapter implements ObjectStoragePort {
  private readonly uploads: UploadsServiceLike;
  private readonly repository: UploadsRepositoryLike;

  constructor(deps: LegacyObjectStorageAdapterDeps) {
    this.uploads = deps.uploads;
    this.repository = deps.repository;
  }

  async createUpload(input: CreateUploadInput): Promise<PendingUpload> {
    const record = await this.uploads.upload(input.actor.id, {
      base64: input.base64,
      originalName: input.originalName,
      mimeType: input.mimeType,
      bucket: input.bucket ?? "uploads",
      purpose: input.purpose,
      linkedTo: input.linkedTo,
      linkedId: input.linkedId,
    });

    return {
      objectId: record.id,
      status: "ready",
    };
  }

  async finalizeUpload(input: FinalizeUploadInput): Promise<StoredObject> {
    const record = await this.repository.findById(input.objectId);
    if (!record || record.uploadedBy !== input.actor.id) {
      throw new NotFoundException("Upload not found");
    }

    return {
      objectId: record.id,
      bucket: record.bucket ?? "uploads",
      path: record.path,
      mimeType: record.mimeType,
      size: record.size,
      originalName: record.originalName,
    };
  }

  async createDownloadUrl(
    objectId: string,
    actor: StorageActor,
  ): Promise<string> {
    const result = await this.uploads.getSignedUrl(objectId, actor.id);
    return result.url;
  }

  async deleteObject(objectId: string, actor: StorageActor): Promise<void> {
    await this.uploads.remove(objectId, actor.id);
  }
}

export function createLegacyObjectStorageAdapter(
  deps: LegacyObjectStorageAdapterDeps,
): ObjectStoragePort {
  return new LegacyObjectStorageAdapter(deps);
}

/**
 * Production wiring — loads uploads modules only when called so unit tests can
 * inject fakes without pulling Prisma.
 */
export async function createDefaultLegacyObjectStorageAdapter(): Promise<ObjectStoragePort> {
  const [{ uploadsService }, { uploadsRepository }] = await Promise.all([
    import("@/modules/uploads/uploads.service"),
    import("@/modules/uploads/uploads.repository"),
  ]);

  return new LegacyObjectStorageAdapter({
    uploads: uploadsService,
    repository: uploadsRepository,
  });
}
