/**
 * Provider-neutral object storage boundary (master plan §9.1).
 * Domain code depends on this port; Supabase/R2 adapters stay behind it.
 */

export interface StorageActor {
  id: string;
}

export interface CreateUploadInput {
  actor: StorageActor;
  originalName: string;
  mimeType: string;
  size: number;
  purpose?: string;
  linkedTo?: string;
  linkedId?: string;
  /** Legacy buffered upload body (current Express path). */
  base64: string;
  bucket?:
    | "article"
    | "avatars"
    | "blog"
    | "receipts"
    | "documents"
    | "uploads";
}

export interface PendingUpload {
  objectId: string;
  status: "pending" | "ready";
  /** Present only for direct-to-object signed upload flows (R2). */
  uploadUrl?: string;
}

export interface FinalizeUploadInput {
  objectId: string;
  actor: StorageActor;
}

export interface StoredObject {
  objectId: string;
  bucket: string;
  path: string;
  mimeType: string;
  size: number;
  originalName: string;
  url?: string;
}

export interface ObjectStoragePort {
  createUpload(input: CreateUploadInput): Promise<PendingUpload>;
  finalizeUpload(input: FinalizeUploadInput): Promise<StoredObject>;
  createDownloadUrl(objectId: string, actor: StorageActor): Promise<string>;
  deleteObject(objectId: string, actor: StorageActor): Promise<void>;
}
