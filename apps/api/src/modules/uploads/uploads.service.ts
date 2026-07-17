import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import {
  type BucketName,
  createSignedUrl,
  deleteFile,
  resolveDisplayUrl,
  uploadBase64,
} from "@/infrastructure/storage/supabase-storage";
import {
  isModuleControlledUploadPurpose,
  uploadsRepository,
} from "@/modules/uploads/uploads.repository";
import type { UploadBase64Input } from "@/modules/uploads/uploads.validation";

export const uploadsService = {
  async list(userId: string, page: number, limit: number) {
    const { data, total } = await uploadsRepository.findAll(
      userId,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async upload(userId: string, input: UploadBase64Input) {
    const bucket = (input.bucket || "uploads") as BucketName;

    const result = await uploadBase64(bucket, userId, {
      base64: input.base64,
      originalName: input.originalName,
      mimeType: input.mimeType,
    });

    const record = await uploadsRepository.create({
      filename: input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_"),
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: Buffer.from(input.base64, "base64").length,
      path: result.path,
      bucket: result.bucket,
      uploadedBy: userId,
      purpose: input.purpose,
      linkedTo: input.linkedTo,
      linkedId: input.linkedId,
    });

    // Private buckets reject direct fetches from the public URL — hand the
    // caller a freshly signed URL so the immediate preview renders instead
    // of showing Supabase's raw "Bucket not found" JSON in the iframe.
    const displayUrl = await resolveDisplayUrl(result.bucket, result.path);
    return { ...record, url: displayUrl };
  },

  /**
   * Mint a signed URL for an upload. Enforces ownership — only the
   * uploader can read their own object. (#517: previously the userId
   * argument was ignored, letting any authenticated user fetch any
   * upload by ID.)
   *
   * Admin bypass is deliberately NOT wired here yet. If product
   * later needs a cross-user "see all uploads" view, gate it on a
   * dedicated permission (e.g. `uploads:manage`) and pass
   * `userPermissions` from the controller — same shape the expenses
   * receipt path uses.
   */
  async getSignedUrl(uploadId: string, userId: string) {
    const upload = await uploadsRepository.findById(uploadId);
    if (!upload) {
      throw new NotFoundException("Upload not found");
    }
    if (upload.uploadedBy !== userId) {
      throw new ForbiddenException("You do not have access to this upload");
    }
    if (isModuleControlledUploadPurpose(upload.purpose)) {
      throw new ForbiddenException(
        "Use the module-specific download endpoint for this file",
      );
    }

    const signedUrl = await createSignedUrl(
      upload.bucket || "uploads",
      upload.path,
    );
    return { url: signedUrl };
  },

  /**
   * Delete an upload. Same ownership rule as `getSignedUrl`. (#517.)
   */
  async remove(uploadId: string, userId: string) {
    // The repository locks and deletes the database row before this method
    // touches storage. Legal signatures hold a restrictive FK to that row,
    // so concurrent signing and deletion cannot orphan retained evidence.
    const result = await uploadsRepository.removeOwnedIfUnreferenced(
      uploadId,
      userId,
    );
    if (result.status === "missing") {
      throw new NotFoundException("Upload not found");
    }
    if (result.status === "forbidden") {
      throw new ForbiddenException(
        "You do not have access to delete this upload",
      );
    }
    if (result.status === "protected") {
      throw new ConflictException(
        "This file is retained by an application record and cannot be deleted",
      );
    }

    await deleteFile(result.bucket, result.path);
  },
};
