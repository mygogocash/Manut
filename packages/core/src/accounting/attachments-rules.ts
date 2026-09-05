import { BadRequestException } from "../http-exception";

// FileUpload.linkedTo values already used by journal approve / audit resources.
// Invoice send and payment posting query this same store — do not add another.
export const ACCOUNTING_INVOICE_LINKED_TO = "invoice";
export const ACCOUNTING_PAYMENT_LINKED_TO = "payment";
export const ACCOUNTING_JOURNAL_LINKED_TO = "journal_entry";

export const ACCOUNTING_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ACCOUNTING_ATTACHMENT_MAX_FILES = 10;
export const ACCOUNTING_ATTACHMENT_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

export function assertAttachmentFileAllowed(opts: {
  mimeType: string;
  size: number;
}): void {
  if (!ACCOUNTING_ATTACHMENT_MIME.has(opts.mimeType)) {
    throw new BadRequestException(
      `Attachment type ${opts.mimeType} is not allowed`,
    );
  }
  if (opts.size > ACCOUNTING_ATTACHMENT_MAX_BYTES) {
    throw new BadRequestException("Attachment exceeds 10 MB");
  }
}

export function assertAttachmentQuota(existingCount: number): void {
  if (existingCount >= ACCOUNTING_ATTACHMENT_MAX_FILES) {
    throw new BadRequestException("Maximum 10 attachments per document");
  }
}

export function assertHasAttachment(count: number): void {
  if (count < 1) {
    throw new BadRequestException(
      "At least one attachment is required before approval or issuance",
    );
  }
}
