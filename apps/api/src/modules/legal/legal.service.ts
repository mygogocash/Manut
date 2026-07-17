import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import {
  sendEmail,
  sendRequiredEmail,
} from "@/infrastructure/email/email.service";
import {
  createSignedUrl,
  downloadToBuffer,
  parseTrustedStorageUrl,
  STORAGE_BUCKETS,
} from "@/infrastructure/storage/supabase-storage";
import { PORTAL_URL } from "@/lib/portal-url";
import {
  legalRepository,
  type LegalSigningArtifactSnapshot,
} from "@/modules/legal/legal.repository";
import type {
  CreateLegalAttachmentInput,
  CreateLegalDocumentInput,
  CreateShareInput,
  DeclineSignatureInput,
  LegalQuery,
  SendForSignatureInput,
  SharedLegalQuery,
  SubmitSignatureInput,
  UpdateLegalAttachmentInput,
  UpdateLegalDocumentInput,
  UpdateLegalNotificationSettingsInput,
  UpdateVisibilityInput,
} from "@/modules/legal/legal.validation";

// Alert-category → settings toggle field. A document is included in the
// expiry digest only when its category's toggle is enabled.
const CATEGORY_TOGGLE = {
  contract_expiry: "notifyContractExpiry",
  contract_review: "notifyContractReview",
  initial_drafting: "notifyInitialDrafting",
  licence_renewal: "notifyLicenceRenewal",
  compliance_filing: "notifyComplianceFiling",
  counterparty_review: "notifyCounterpartyReview",
} as const;

// Daily horizons we surface in the digest. Anything inside the smallest
// bucket gets the most urgent tone in the email body.
const DIGEST_HORIZONS = [1, 7, 14, 30] as const;

export class LegalService {
  async list(query: LegalQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await legalRepository.findMany(
      filters,
      page,
      limit,
    );
    return {
      data: data.map(serialize),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async stats() {
    return { data: await legalRepository.stats() };
  }

  async getById(id: string) {
    const doc = await legalRepository.findById(id);
    if (!doc) throw new NotFoundException("Legal document not found");
    return { data: serialize(doc) };
  }

  // The `documents` Supabase bucket is private, so the raw fileUrl
  // stored on the row 404s when opened directly. Mint a short-lived
  // signed URL on demand. Mirrors hrms.getAgreementDownloadUrl.
  async getDownloadUrl(id: string) {
    const doc = await legalRepository.findById(id);
    if (!doc) throw new NotFoundException("Legal document not found");
    if (!doc.fileUrl) {
      throw new NotFoundException("This document has no attached file");
    }
    const parsed = await this.getTrustedLegalStorageObject(
      doc.fileUrl,
      "legal-document",
      "Document",
    );
    const url = await createSignedUrl(parsed.bucket, parsed.path, 300);
    return { data: { url, fileName: doc.fileName ?? null } };
  }

  private async getTrustedLegalStorageObject(
    fileUrl: string,
    purpose: "legal-document" | "legal-document-attachment",
    label: "Document" | "Attachment",
  ) {
    const parsed = parseTrustedStorageUrl(fileUrl, [STORAGE_BUCKETS.DOCUMENTS]);
    if (!parsed) {
      throw new BadRequestException(
        `${label} file URL is not from trusted document storage`,
      );
    }
    const upload = await legalRepository.findLegalUploadByPath(
      parsed.bucket,
      parsed.path,
      purpose,
    );
    if (!upload) {
      throw new BadRequestException(
        `${label} file is not registered as a legal ${
          purpose === "legal-document" ? "document" : "attachment"
        } upload`,
      );
    }
    return { ...parsed, upload };
  }

  private async verifySigningArtifact(sig: SerializableSignature) {
    const artifact = signingArtifact(sig);
    const storedSnapshot = await downloadToBuffer(
      artifact.bucket,
      artifact.path,
    );
    const storedSha256 = createHash("sha256")
      .update(storedSnapshot.buffer)
      .digest("hex");
    if (
      storedSnapshot.buffer.length !== artifact.size ||
      storedSha256 !== artifact.sha256
    ) {
      throw new ConflictException(
        "The signing document failed integrity verification",
      );
    }
    return artifact;
  }

  async create(input: CreateLegalDocumentInput) {
    const doc = await legalRepository.create({
      title: input.title,
      kind: input.kind,
      reference: input.reference,
      parties: input.parties ?? [],
      ownerId: input.ownerId,
      entityId: input.entityId,
      effectiveDate: input.effectiveDate
        ? new Date(input.effectiveDate)
        : undefined,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      renewalLeadDays: input.renewalLeadDays,
      status: input.status,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      folder: input.folder,
      alertCategory: input.alertCategory ?? undefined,
      notes: input.notes,
    });
    return { data: serialize(doc) };
  }

  async update(id: string, input: UpdateLegalDocumentInput) {
    const existing = await legalRepository.findById(id);
    if (!existing) throw new NotFoundException("Legal document not found");

    const nonSigningData = {
      reference: input.reference,
      parties: input.parties,
      ownerId: input.ownerId,
      entityId: input.entityId,
      effectiveDate:
        input.effectiveDate === null
          ? null
          : input.effectiveDate
            ? new Date(input.effectiveDate)
            : undefined,
      expiryDate:
        input.expiryDate === null
          ? null
          : input.expiryDate
            ? new Date(input.expiryDate)
            : undefined,
      renewalLeadDays: input.renewalLeadDays,
      folder: input.folder,
      alertCategory: input.alertCategory,
      notes: input.notes,
    };
    const changesSigningArtifact =
      (input.title !== undefined && input.title !== existing.title) ||
      (input.kind !== undefined && input.kind !== existing.kind) ||
      (input.fileUrl !== undefined && input.fileUrl !== existing.fileUrl) ||
      (input.fileName !== undefined && input.fileName !== existing.fileName) ||
      (input.status !== undefined && input.status !== existing.status);
    const doc = changesSigningArtifact
      ? await legalRepository.updateBeforeSigning(id, {
          ...nonSigningData,
          title: input.title,
          kind: input.kind,
          status: input.status,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
        })
      : await legalRepository.update(id, nonSigningData);
    if (doc === undefined) {
      throw new NotFoundException("Legal document not found");
    }
    if (doc === null) {
      throw new ConflictException(
        "Signed or reviewed document evidence is immutable; create a new document version",
      );
    }
    return { data: serialize(doc) };
  }

  async listFolders() {
    return { data: await legalRepository.findFolders() };
  }

  async remove(id: string) {
    const existing = await legalRepository.findById(id);
    if (!existing) throw new NotFoundException("Legal document not found");
    const removed = await legalRepository.removeBeforeSigning(id);
    if (!removed) {
      throw new ConflictException(
        "A document with signing evidence cannot be deleted",
      );
    }
    return { data: { id } };
  }

  // ── Sharing ─────────────────────────────────────────────────────────────

  async setVisibility(documentId: string, input: UpdateVisibilityInput) {
    const existing = await legalRepository.findById(documentId);
    if (!existing) throw new NotFoundException("Legal document not found");
    const updated = await legalRepository.updateVisibility(
      documentId,
      input.visibility,
    );
    return { data: serialize(updated) };
  }

  async addShare(documentId: string, input: CreateShareInput, actorId: string) {
    const existing = await legalRepository.findById(documentId);
    if (!existing) throw new NotFoundException("Legal document not found");

    // Flip the doc to "restricted" the moment any share is added so
    // legal doesn't have to remember a separate visibility toggle.
    // `public` documents stay public (the share row is harmless but
    // useful for a future audit log).
    if (existing.visibility === "private") {
      await legalRepository.updateVisibility(documentId, "restricted");
    }

    const share = await legalRepository.createShare({
      documentId,
      type: input.type,
      userId: input.type === "user" ? input.userId : undefined,
      department: input.type === "department" ? input.department : undefined,
      groupId: input.type === "group" ? input.groupId : undefined,
      createdById: actorId,
    });
    const refreshed = await legalRepository.findById(documentId);
    return {
      data: {
        share: serializeShare(share),
        document: refreshed ? serialize(refreshed) : null,
      },
    };
  }

  async removeShare(documentId: string, shareId: string) {
    const existing = await legalRepository.findShareById(shareId);
    if (!existing || existing.documentId !== documentId) {
      throw new NotFoundException("Share not found");
    }
    await legalRepository.removeShare(shareId);
    const refreshed = await legalRepository.findById(documentId);
    return {
      data: {
        id: shareId,
        document: refreshed ? serialize(refreshed) : null,
      },
    };
  }

  async listShares(documentId: string) {
    const existing = await legalRepository.findById(documentId);
    if (!existing) throw new NotFoundException("Legal document not found");
    const shares = await legalRepository.findSharesByDocument(documentId);
    return { data: shares.map(serializeShare) };
  }

  async listShareOptions() {
    return { data: await legalRepository.findShareOptions() };
  }

  // Employee "Shared with me" list. Pulls public + per-user + per-
  // department + per-group documents the actor is granted to see.
  async listSharedWithMe(userId: string, query: SharedLegalQuery) {
    const ctx = await legalRepository.findUserVisibilityContext(userId);
    const { page, limit, ...rest } = query;
    const { data, total } = await legalRepository.findMany(
      {
        ...rest,
        visibleToUser: ctx,
      },
      page,
      limit,
    );
    return {
      data: data.map(serialize),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Permission check used by `getById` / `getDownloadUrl` when the
  // caller only holds `legal:view-shared` (no `legal:read`). Returns
  // true if the user is the owner, the doc is public, or any matching
  // share row exists.
  private async userCanSeeDoc(
    userId: string,
    doc: { id: string; ownerId: string | null; visibility: string },
  ): Promise<boolean> {
    if (doc.visibility === "public") return true;
    if (doc.ownerId === userId) return true;
    const ctx = await legalRepository.findUserVisibilityContext(userId);
    const shares = await legalRepository.findSharesByDocument(doc.id);
    return shares.some((s) => {
      if (s.type === "user" && s.userId === userId) return true;
      if (
        s.type === "department" &&
        ctx.department &&
        s.department === ctx.department
      ) {
        return true;
      }
      if (s.type === "group" && s.groupId && ctx.groupIds.includes(s.groupId)) {
        return true;
      }
      return false;
    });
  }

  async getByIdForRecipient(id: string, userId: string) {
    const doc = await legalRepository.findById(id);
    if (!doc) throw new NotFoundException("Legal document not found");
    if (!(await this.userCanSeeDoc(userId, doc))) {
      throw new NotFoundException("Legal document not found");
    }
    return { data: serialize(doc) };
  }

  async getDownloadUrlForRecipient(id: string, userId: string) {
    const doc = await legalRepository.findById(id);
    if (!doc) throw new NotFoundException("Legal document not found");
    if (!(await this.userCanSeeDoc(userId, doc))) {
      throw new NotFoundException("Legal document not found");
    }
    if (!doc.fileUrl) {
      throw new NotFoundException("This document has no attached file");
    }
    const parsed = await this.getTrustedLegalStorageObject(
      doc.fileUrl,
      "legal-document",
      "Document",
    );
    const url = await createSignedUrl(parsed.bucket, parsed.path, 300);
    return { data: { url, fileName: doc.fileName ?? null } };
  }

  // ── Attachments ─────────────────────────────────────────────────────────

  async addAttachment(
    documentId: string,
    input: CreateLegalAttachmentInput,
    actorId: string,
  ) {
    const doc = await legalRepository.findById(documentId);
    if (!doc) throw new NotFoundException("Legal document not found");
    const attachment = await legalRepository.createAttachment({
      documentId,
      kind: input.kind,
      label: input.label,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      effectiveDate: input.effectiveDate
        ? new Date(input.effectiveDate)
        : undefined,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      notes: input.notes,
      uploadedById: actorId,
    });
    const refreshed = await legalRepository.findById(documentId);
    return {
      data: {
        attachment: serializeAttachment(attachment),
        document: refreshed ? serialize(refreshed) : null,
      },
    };
  }

  async updateAttachment(
    documentId: string,
    attachmentId: string,
    input: UpdateLegalAttachmentInput,
  ) {
    const existing = await legalRepository.findAttachmentById(attachmentId);
    if (!existing || existing.documentId !== documentId) {
      throw new NotFoundException("Attachment not found");
    }
    const attachment = await legalRepository.updateAttachment(attachmentId, {
      kind: input.kind,
      label: input.label,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      effectiveDate:
        input.effectiveDate === null
          ? null
          : input.effectiveDate
            ? new Date(input.effectiveDate)
            : undefined,
      expiryDate:
        input.expiryDate === null
          ? null
          : input.expiryDate
            ? new Date(input.expiryDate)
            : undefined,
      notes: input.notes,
    });
    const refreshed = await legalRepository.findById(documentId);
    return {
      data: {
        attachment: serializeAttachment(attachment),
        document: refreshed ? serialize(refreshed) : null,
      },
    };
  }

  async removeAttachment(documentId: string, attachmentId: string) {
    const existing = await legalRepository.findAttachmentById(attachmentId);
    if (!existing || existing.documentId !== documentId) {
      throw new NotFoundException("Attachment not found");
    }
    await legalRepository.removeAttachment(attachmentId);
    const refreshed = await legalRepository.findById(documentId);
    return {
      data: {
        id: attachmentId,
        document: refreshed ? serialize(refreshed) : null,
      },
    };
  }

  // The `documents` bucket is private, so attachment URLs also need a
  // freshly minted signed URL on demand. Mirrors `getDownloadUrl`.
  async getAttachmentDownloadUrl(documentId: string, attachmentId: string) {
    const existing = await legalRepository.findAttachmentById(attachmentId);
    if (!existing || existing.documentId !== documentId) {
      throw new NotFoundException("Attachment not found");
    }
    const parsed = await this.getTrustedLegalStorageObject(
      existing.fileUrl,
      "legal-document-attachment",
      "Attachment",
    );
    const url = await createSignedUrl(parsed.bucket, parsed.path, 300);
    return { data: { url, fileName: existing.fileName } };
  }

  // Daily-cron entry point. Pulls all active docs whose *effective*
  // expiry (max of parent + attachment expiries) falls inside the
  // widest horizon, groups them by owner email, and sends one digest
  // per owner. No-op (and zero counters) if nothing is due.
  // Configurable Legal notification settings (singleton). Mirrors the IT
  // Helpdesk settings shape.
  async getNotificationSettings() {
    const s = await legalRepository.getNotificationSettings();
    return {
      data: {
        recipients: s.recipients,
        notifyContractExpiry: s.notifyContractExpiry,
        notifyContractReview: s.notifyContractReview,
        notifyInitialDrafting: s.notifyInitialDrafting,
        notifyLicenceRenewal: s.notifyLicenceRenewal,
        notifyComplianceFiling: s.notifyComplianceFiling,
        notifyCounterpartyReview: s.notifyCounterpartyReview,
        updatedAt: s.updatedAt.toISOString(),
      },
    };
  }

  async updateNotificationSettings(
    input: UpdateLegalNotificationSettingsInput,
  ) {
    const recipients = Array.from(new Set(input.recipients));
    const s = await legalRepository.updateNotificationSettings({
      recipients,
      notifyContractExpiry: input.notifyContractExpiry,
      notifyContractReview: input.notifyContractReview,
      notifyInitialDrafting: input.notifyInitialDrafting,
      notifyLicenceRenewal: input.notifyLicenceRenewal,
      notifyComplianceFiling: input.notifyComplianceFiling,
      notifyCounterpartyReview: input.notifyCounterpartyReview,
    });
    return {
      data: {
        recipients: s.recipients,
        notifyContractExpiry: s.notifyContractExpiry,
        notifyContractReview: s.notifyContractReview,
        notifyInitialDrafting: s.notifyInitialDrafting,
        notifyLicenceRenewal: s.notifyLicenceRenewal,
        notifyComplianceFiling: s.notifyComplianceFiling,
        notifyCounterpartyReview: s.notifyCounterpartyReview,
        updatedAt: s.updatedAt.toISOString(),
      },
    };
  }

  async processExpiryDigest() {
    const settings = await legalRepository.getNotificationSettings();
    const recipients = settings.recipients ?? [];
    // The digest now goes to the configured team recipient list (replacing
    // the old per-owner fan-out). No recipients → nothing to send; log so
    // an empty list is visible rather than silently dropping alerts.
    if (recipients.length === 0) {
      logger.warn(
        "legal expiry digest skipped: no recipients configured in Legal notification settings",
      );
      return { sent: false, documentsIncluded: 0, recipients: 0 };
    }

    const widest = Math.max(...DIGEST_HORIZONS);
    const docs = await legalRepository.findExpiringSoonWithEffective(widest);
    const today = startOfDayUTC(new Date());

    const included = docs
      .map((doc) => {
        const eff = effectiveExpiry(doc);
        if (!eff) return null;
        // Only alert on documents tagged with a category whose toggle is on.
        const cat = doc.alertCategory;
        if (!cat || !(cat in CATEGORY_TOGGLE)) return null;
        const toggle = CATEGORY_TOGGLE[cat as keyof typeof CATEGORY_TOGGLE];
        if (!settings[toggle]) return null;
        return {
          id: doc.id,
          title: doc.title,
          kind: doc.kind,
          expiryDate: eff,
          daysRemaining: Math.floor(
            (startOfDayUTC(eff).getTime() - today.getTime()) / 86_400_000,
          ),
        };
      })
      .filter((d): d is NonNullable<typeof d> => d != null)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    if (included.length === 0) {
      return {
        sent: false,
        documentsIncluded: 0,
        recipients: recipients.length,
      };
    }

    const rows = included
      .map(
        (d) =>
          `<tr>
            <td style="padding:6px 12px;">${escapeHtml(d.title)}</td>
            <td style="padding:6px 12px;">${escapeHtml(d.kind)}</td>
            <td style="padding:6px 12px;">${
              d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : "—"
            }</td>
            <td style="padding:6px 12px;">${formatDays(d.daysRemaining)}</td>
            <td style="padding:6px 12px;">
              <a href="${PORTAL_URL}/legal?focus=${d.id}">Open</a>
            </td>
          </tr>`,
      )
      .join("");

    try {
      await sendEmail({
        to: recipients,
        templateId: "legal-document-expiry-digest",
        variables: {
          ownerName: "Legal team",
          rowsHtml: rows,
          portalUrl: `${PORTAL_URL}/legal`,
        },
      });
    } catch (err) {
      logger.warn("legal digest send failed", {
        err: err instanceof Error ? err.message : String(err),
        recipients: recipients.length,
      });
      return {
        sent: false,
        documentsIncluded: 0,
        recipients: recipients.length,
      };
    }

    return {
      sent: true,
      documentsIncluded: included.length,
      recipients: recipients.length,
    };
  }

  // ── Phase 2 e-signature flow ──────────────────────────────────────────

  async listSignatures(documentId: string) {
    const doc = await legalRepository.findById(documentId);
    if (!doc) throw new NotFoundException("Legal document not found");
    const sigs = await legalRepository.findSignaturesByDocument(documentId);
    return { data: sigs.map(serializeSignature) };
  }

  async sendForSignature(
    documentId: string,
    input: SendForSignatureInput,
    actorId: string,
  ) {
    const doc = await legalRepository.findById(documentId);
    if (!doc) throw new NotFoundException("Legal document not found");
    if (doc.status !== "active" && doc.status !== "draft") {
      throw new BadRequestException(
        "Only draft or active documents can be sent for signature",
      );
    }
    if (!doc.fileUrl) {
      throw new BadRequestException(
        "A document file is required before requesting signatures",
      );
    }
    const trustedSource = await this.getTrustedLegalStorageObject(
      doc.fileUrl,
      "legal-document",
      "Document",
    );

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, name: true, email: true },
    });
    if (!actor) throw new NotFoundException("Acting user not found");

    // Normalize the input into a recipients[] list. Single-signer
    // callers pass `signerEmail`/`signerName`; multi-signer callers
    // pass a `signers[]` array.
    const recipients =
      input.signers && input.signers.length > 0
        ? input.signers.map((s) => ({
            signerEmail: s.signerEmail.trim().toLowerCase(),
            signerName: s.signerName.trim(),
            signingOrder: s.signingOrder ?? 1,
          }))
        : [
            {
              signerEmail: (input.signerEmail ?? "").trim().toLowerCase(),
              signerName: (input.signerName ?? "").trim(),
              signingOrder: input.signingOrder ?? 1,
            },
          ];

    // In-house multi-signer: one row per signer, each with its own
    // token + invite email. Sequential signers are nudged in order
    // (only the first row's invite goes out immediately; subsequent
    // signers are emailed once the previous order completes — handled
    // in submitSignature).
    const batchId = randomUUID();
    const sourceObject = await downloadToBuffer(
      trustedSource.bucket,
      trustedSource.path,
    );
    const snapshot: LegalSigningArtifactSnapshot = {
      bucket: trustedSource.bucket,
      path: trustedSource.path,
      sha256: createHash("sha256").update(sourceObject.buffer).digest("hex"),
      size: sourceObject.buffer.length,
      mimeType:
        sourceObject.contentType ||
        trustedSource.upload.mimeType ||
        "application/octet-stream",
      fileName: doc.fileName || trustedSource.upload.originalName || "document",
      title: doc.title,
      kind: doc.kind,
      sourceFileUrl: doc.fileUrl,
      sourceFileName: doc.fileName ?? null,
      uploadId: trustedSource.upload.id,
    };
    const lowestOrder = Math.min(...recipients.map((r) => r.signingOrder));
    const created = await legalRepository.createSignatures(
      documentId,
      batchId,
      snapshot,
      recipients.map((r) => ({
        signerEmail: r.signerEmail,
        signerName: r.signerName,
        token: randomBytes(32).toString("hex"),
        status: "pending",
        signingOrder: r.signingOrder,
        inviteMessage: input.inviteMessage,
        sentAt: undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdById: actorId,
      })),
    );
    if (!created) {
      throw new ConflictException(
        "The document is no longer available for signature",
      );
    }

    // Email only the lowest-order signer(s) immediately. Higher
    // orders get emailed when the previous round finishes signing.
    const activated = new Map<string, SerializableSignature>();
    try {
      for (const sig of created.filter((s) => s.signingOrder === lowestOrder)) {
        const delivered = await this.deliverSignatureInvite(sig, {
          signerEmail: sig.signerEmail,
          signerName: sig.signerName,
          inviterName: actor.name,
          documentTitle: doc.title,
          documentKind: doc.kind,
          inviteMessage: sig.inviteMessage,
          token: sig.token,
        });
        if (!delivered) {
          throw new ConflictException(
            "The signature invitation is already being processed",
          );
        }
        activated.set(sig.id, delivered);
      }
    } catch (err) {
      await legalRepository.cancelSignatureBatch(documentId, batchId);
      throw err;
    }

    const signatures = created.map((sig) => activated.get(sig.id) ?? sig);

    return {
      data:
        signatures.length === 1
          ? serializeSignature(signatures[0]!)
          : signatures.map(serializeSignature),
    };
  }

  async getByToken(token: string) {
    const sig = await legalRepository.findSignatureByToken(token);
    if (!sig) throw new NotFoundException("Signature request not found");
    if (sig.expiresAt && sig.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This signing link has expired");
    }
    if (sig.status === "pending") {
      throw new BadRequestException("This signing request is not active yet");
    }
    const artifact = signingArtifact(sig);
    const snapshotDocument = {
      id: sig.document.id,
      title: artifact.title,
      kind: artifact.kind,
      fileUrl: null as string | null,
      fileName: artifact.fileName,
      status: sig.document.status,
    };
    const canReviewDocument = sig.status === "sent" || sig.status === "viewed";
    if (!canReviewDocument) {
      return {
        data: {
          signature: serializePublicSignature(sig),
          document: snapshotDocument,
        },
      };
    }
    await this.verifySigningArtifact(sig);
    const documentFileUrl = await createSignedUrl(
      artifact.bucket,
      artifact.path,
      300,
    );
    return {
      data: {
        signature: serializePublicSignature(sig),
        document: {
          ...snapshotDocument,
          fileUrl: documentFileUrl,
        },
      },
    };
  }

  async markViewed(token: string) {
    const sig = await legalRepository.findSignatureByToken(token);
    if (!sig) throw new NotFoundException("Signature request not found");
    if (sig.viewedAt) return; // first view only — keep original timestamp.
    if (sig.status === "sent") {
      await legalRepository.transitionSignature(sig.id, ["sent"], {
        status: "viewed",
        viewedAt: new Date(),
      });
    }
  }

  async submitSignature(
    token: string,
    input: SubmitSignatureInput,
    ip: string | null,
    userAgent: string | null,
  ) {
    const sig = await legalRepository.findSignatureByToken(token);
    if (!sig) throw new NotFoundException("Signature request not found");
    if (sig.status === "signed") {
      throw new BadRequestException("This document has already been signed");
    }
    if (sig.status === "declined") {
      throw new BadRequestException("This signature request was declined");
    }
    if (sig.status === "cancelled") {
      throw new BadRequestException("This signature request was cancelled");
    }
    if (sig.status === "pending") {
      throw new BadRequestException("This signing request is not active yet");
    }
    if (sig.expiresAt && sig.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This signing link has expired");
    }

    await this.verifySigningArtifact(sig);

    const updated = await legalRepository.transitionSignature(
      sig.id,
      ["sent", "viewed"],
      {
        status: "signed",
        signedAt: new Date(),
        signatureText: input.signatureText,
        signatureMethod: "typed",
        signedIp: ip ?? undefined,
        signedUserAgent: userAgent ?? undefined,
      },
    );
    if (!updated) {
      throw new BadRequestException("This signing request is no longer active");
    }

    // Sequential nudge: any signers in the next pending order get
    // their invite email now. Same-order signers (parallel) all
    // already received their invites at send time.
    void this.nudgeNextPendingSigners(
      sig.documentId,
      sig.batchId,
      sig.signingOrder,
    ).catch((err) => {
      logger.warn("legal next-signer nudge failed", {
        err: err instanceof Error ? err.message : String(err),
        documentId: sig.documentId,
      });
    });

    // Flip the parent doc to "signed" only when every signature on
    // this document is in a terminal state and at least one signed.
    await this.maybeMarkDocumentSigned(sig.documentId, sig.batchId);

    return { data: serializePublicSignature(updated) };
  }

  /**
   * Email the lowest-order signers whose order > completedOrder and
   * status is still "sent" / "pending" / "viewed".
   */
  private async nudgeNextPendingSigners(
    documentId: string,
    batchId: string,
    completedOrder: number,
  ) {
    const all = await legalRepository.findSignaturesByDocument(
      documentId,
      batchId,
    );
    const completedRound = all.filter(
      (signature) => signature.signingOrder === completedOrder,
    );
    if (
      completedRound.length === 0 ||
      completedRound.some((signature) => signature.status !== "signed")
    ) {
      return;
    }
    const pending = all.filter(
      (s) =>
        s.signingOrder > completedOrder &&
        (s.status === "sent" ||
          s.status === "pending" ||
          s.status === "viewed"),
    );
    if (pending.length === 0) return;
    const nextOrder = Math.min(...pending.map((s) => s.signingOrder));
    const next = pending.filter((s) => s.signingOrder === nextOrder);
    const doc = await legalRepository.findById(documentId);
    if (!doc) return;
    for (const sig of next) {
      try {
        await this.deliverSignatureInvite(sig, {
          signerEmail: sig.signerEmail,
          signerName: sig.signerName,
          inviterName: doc.owner?.name ?? "Legal team",
          documentTitle: doc.title,
          documentKind: doc.kind,
          inviteMessage: sig.inviteMessage,
          token: sig.token,
        });
      } catch (err) {
        logger.warn("legal signing invite send failed", {
          err: err instanceof Error ? err.message : String(err),
          signature: sig.id,
        });
      }
    }
  }

  /**
   * Flips the parent doc to "signed" only when every
   * signature on the document has reached a terminal state and at
   * least one of them succeeded.
   */
  private async maybeMarkDocumentSigned(documentId: string, batchId: string) {
    const all = await legalRepository.findSignaturesByDocument(
      documentId,
      batchId,
    );
    if (all.length === 0) return;
    if (!all.every((signature) => signature.status === "signed")) return;
    await legalRepository.markDocumentSignedIfSignable(documentId, batchId);
  }

  async declineSignature(
    token: string,
    input: DeclineSignatureInput,
    ip: string | null,
    userAgent: string | null,
  ) {
    const sig = await legalRepository.findSignatureByToken(token);
    if (!sig) throw new NotFoundException("Signature request not found");
    if (sig.status === "signed") {
      throw new BadRequestException("Already signed — cannot decline");
    }
    if (sig.status === "declined" || sig.status === "cancelled") {
      throw new BadRequestException("This request is no longer active");
    }
    if (sig.status === "pending") {
      throw new BadRequestException("This signing request is not active yet");
    }
    if (sig.expiresAt && sig.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This signing link has expired");
    }

    const updated = await legalRepository.transitionSignature(
      sig.id,
      ["sent", "viewed"],
      {
        status: "declined",
        declinedAt: new Date(),
        declineReason: input.reason,
        signedIp: ip ?? undefined,
        signedUserAgent: userAgent ?? undefined,
      },
    );
    if (!updated) {
      throw new BadRequestException("This signing request is no longer active");
    }

    return { data: serializePublicSignature(updated) };
  }

  async cancelSignature(signatureId: string) {
    const sig = await legalRepository.findSignatureById(signatureId);
    if (!sig) throw new NotFoundException("Signature request not found");
    if (sig.status === "signed") {
      throw new BadRequestException("Already signed — cannot cancel");
    }
    const updated = await legalRepository.transitionSignature(
      signatureId,
      ["pending", "sent", "viewed"],
      { status: "cancelled" },
    );
    if (!updated) {
      throw new BadRequestException("This signing request is no longer active");
    }
    return { data: serializeSignature(updated) };
  }

  // ────────────────────────────────────────────────────────────────────

  private async deliverSignatureInvite(
    signature: SerializableSignature,
    email: Parameters<LegalService["sendInviteEmail"]>[0],
  ): Promise<SerializableSignature | null> {
    const claimedAt = new Date();
    const claimed = await legalRepository.claimSignatureInvite(
      signature.id,
      claimedAt,
    );
    if (!claimed) return null;

    try {
      await this.sendInviteEmail(email);
      const activated = await legalRepository.activateSignatureInvite(
        signature.id,
        claimedAt,
      );
      if (!activated) {
        throw new ConflictException(
          "The signature invitation could not be activated",
        );
      }
      return activated;
    } catch (err) {
      try {
        await legalRepository.releaseSignatureInvite(signature.id, claimedAt);
      } catch (releaseErr) {
        logger.error("legal signing invite claim release failed", {
          err:
            releaseErr instanceof Error
              ? releaseErr.message
              : String(releaseErr),
          signature: signature.id,
        });
      }
      throw err;
    }
  }

  private async sendInviteEmail(args: {
    signerEmail: string;
    signerName: string;
    inviterName: string;
    documentTitle: string;
    documentKind: string;
    inviteMessage: string | null;
    token: string;
  }) {
    const url = `${PORTAL_URL}/sign/${args.token}`;
    const messageBlock = args.inviteMessage
      ? `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #c8a84b;color:#444;">${escapeHtml(
          args.inviteMessage,
        )}</blockquote>`
      : "";
    await sendRequiredEmail({
      to: args.signerEmail,
      templateId: "legal-signature-request",
      variables: {
        signerName: args.signerName,
        inviterName: args.inviterName,
        documentKind: args.documentKind,
        documentTitle: args.documentTitle,
        inviteMessageHtml: messageBlock,
        actionUrl: url,
      },
    });
  }
}

interface SerializableAttachment {
  id: string;
  documentId: string;
  kind: string;
  label: string | null;
  fileUrl: string;
  fileName: string;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  notes: string | null;
  uploadedById: string | null;
  createdAt: Date;
  uploadedBy?: { id: string; name: string; email: string } | null;
}

interface SerializableShare {
  id: string;
  documentId: string;
  type: string;
  userId: string | null;
  department: string | null;
  groupId: string | null;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  group?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
}

interface SerializableDoc {
  id: string;
  title: string;
  kind: string;
  reference: string | null;
  parties: string[];
  ownerId: string | null;
  entityId: string | null;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  renewalLeadDays: number;
  status: string;
  fileUrl: string | null;
  fileName: string | null;
  folder: string | null;
  alertCategory: string | null;
  notes: string | null;
  visibility?: string;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: string; name: string; email: string } | null;
  entity: { id: string; name: string } | null;
  attachments?: SerializableAttachment[];
  shares?: SerializableShare[];
}

// Latest expiry across the parent doc and any attachments. NULL when
// nothing in the contract set carries an expiry date (open-ended).
function effectiveExpiry(doc: SerializableDoc): Date | null {
  let latest: Date | null = doc.expiryDate;
  for (const a of doc.attachments ?? []) {
    if (a.expiryDate && (!latest || a.expiryDate > latest)) {
      latest = a.expiryDate;
    }
  }
  return latest;
}

function serialize(doc: SerializableDoc) {
  const eff = effectiveExpiry(doc);
  const today = startOfDayUTC(new Date());
  // status stays whatever the row was saved with, but `effectiveStatus`
  // demotes an `active` row to `expired` when the rolled-up expiry has
  // passed — this is what the UI badge and stats cards should render.
  const effectiveStatus =
    doc.status === "active" && eff && eff < today ? "expired" : doc.status;
  return {
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    reference: doc.reference,
    parties: doc.parties,
    owner: doc.owner,
    entity: doc.entity,
    effectiveDate: doc.effectiveDate
      ? doc.effectiveDate.toISOString().slice(0, 10)
      : null,
    expiryDate: doc.expiryDate
      ? doc.expiryDate.toISOString().slice(0, 10)
      : null,
    effectiveExpiry: eff ? eff.toISOString().slice(0, 10) : null,
    renewalLeadDays: doc.renewalLeadDays,
    status: doc.status,
    effectiveStatus,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    folder: doc.folder,
    alertCategory: doc.alertCategory,
    notes: doc.notes,
    visibility: doc.visibility ?? "private",
    attachments: (doc.attachments ?? []).map(serializeAttachment),
    shares: (doc.shares ?? []).map(serializeShare),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function serializeShare(s: SerializableShare) {
  return {
    id: s.id,
    documentId: s.documentId,
    type: s.type,
    userId: s.userId,
    department: s.department,
    groupId: s.groupId,
    user: s.user ?? null,
    group: s.group ?? null,
    createdBy: s.createdBy ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

function serializeAttachment(a: SerializableAttachment) {
  return {
    id: a.id,
    documentId: a.documentId,
    kind: a.kind,
    label: a.label,
    fileUrl: a.fileUrl,
    fileName: a.fileName,
    effectiveDate: a.effectiveDate
      ? a.effectiveDate.toISOString().slice(0, 10)
      : null,
    expiryDate: a.expiryDate ? a.expiryDate.toISOString().slice(0, 10) : null,
    notes: a.notes,
    uploadedById: a.uploadedById,
    uploadedBy: a.uploadedBy ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

interface SerializableSignature {
  id: string;
  documentId: string;
  batchId: string;
  signerEmail: string;
  signerName: string;
  token: string;
  status: string;
  inviteMessage: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  signedAt: Date | null;
  declinedAt: Date | null;
  declineReason: string | null;
  signatureText: string | null;
  signatureMethod: string | null;
  expiresAt: Date | null;
  signingOrder: number;
  signedPdfUrl: string | null;
  documentSnapshotBucket: string;
  documentSnapshotPath: string;
  documentSnapshotUploadId: string;
  documentSnapshotSha256: string;
  documentSnapshotSize: number;
  documentSnapshotMimeType: string;
  documentSnapshotFileName: string;
  documentSnapshotTitle: string;
  documentSnapshotKind: string;
  createdAt: Date;
  updatedAt: Date;
}

function signingArtifact(sig: SerializableSignature) {
  if (
    sig.documentSnapshotBucket !== STORAGE_BUCKETS.DOCUMENTS ||
    !sig.documentSnapshotPath ||
    !sig.documentSnapshotUploadId ||
    !/^[0-9a-f]{64}$/.test(sig.documentSnapshotSha256) ||
    sig.documentSnapshotSize < 0 ||
    !sig.documentSnapshotMimeType ||
    !sig.documentSnapshotFileName ||
    !sig.documentSnapshotTitle ||
    !sig.documentSnapshotKind
  ) {
    throw new ConflictException(
      "This signing request has no valid immutable document snapshot",
    );
  }
  return {
    bucket: sig.documentSnapshotBucket,
    path: sig.documentSnapshotPath,
    sha256: sig.documentSnapshotSha256,
    size: sig.documentSnapshotSize,
    mimeType: sig.documentSnapshotMimeType,
    fileName: sig.documentSnapshotFileName,
    title: sig.documentSnapshotTitle,
    kind: sig.documentSnapshotKind,
  };
}

function serializeSignature(sig: SerializableSignature) {
  return {
    id: sig.id,
    documentId: sig.documentId,
    signerEmail: sig.signerEmail,
    signerName: sig.signerName,
    status: sig.status,
    inviteMessage: sig.inviteMessage,
    sentAt: sig.sentAt ? sig.sentAt.toISOString() : null,
    viewedAt: sig.viewedAt ? sig.viewedAt.toISOString() : null,
    signedAt: sig.signedAt ? sig.signedAt.toISOString() : null,
    declinedAt: sig.declinedAt ? sig.declinedAt.toISOString() : null,
    declineReason: sig.declineReason,
    signatureText: sig.signatureText,
    signatureMethod: sig.signatureMethod,
    expiresAt: sig.expiresAt ? sig.expiresAt.toISOString() : null,
    signingOrder: sig.signingOrder,
    signedPdfUrl: sig.signedPdfUrl,
    createdAt: sig.createdAt.toISOString(),
    updatedAt: sig.updatedAt.toISOString(),
  };
}

// Public-facing variant — strips audit fields the external signer
// shouldn't see and never echoes the raw token back.
function serializePublicSignature(sig: SerializableSignature) {
  return {
    id: sig.id,
    documentId: sig.documentId,
    signerEmail: sig.signerEmail,
    signerName: sig.signerName,
    status: sig.status,
    inviteMessage: sig.inviteMessage,
    signedAt: sig.signedAt ? sig.signedAt.toISOString() : null,
    declinedAt: sig.declinedAt ? sig.declinedAt.toISOString() : null,
    declineReason: sig.declineReason,
    expiresAt: sig.expiresAt ? sig.expiresAt.toISOString() : null,
  };
}

function startOfDayUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function formatDays(d: number): string {
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue`;
  if (d === 0) return "today";
  return `${d} day${d === 1 ? "" : "s"}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const legalService = new LegalService();
