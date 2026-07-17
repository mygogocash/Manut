import type { Prisma } from "@manut/database";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { certificateIssuedEmail } from "@/infrastructure/email/templates";
import {
  createSignedUrl,
  deleteFile,
  parseTrustedStorageUrl,
  STORAGE_BUCKETS,
  uploadFile,
} from "@/infrastructure/storage/supabase-storage";
import { buildCertificatePdf } from "@/modules/certificates/certificate.generator";
import { certificatesRepository } from "@/modules/certificates/certificates.repository";
import type {
  CreateCertificateInput,
  ListCertificatesQuery,
} from "@/modules/certificates/certificates.validation";

// 7-day link in the email (recipient may not have a session); short-lived
// link for in-app re-download.
const DOWNLOAD_TTL_EMAIL = 60 * 60 * 24 * 7;
const DOWNLOAD_TTL_PORTAL = 300;

export class CertificatesService {
  // HR/Admin-only listing (gated by certificate:read, which the seed grants
  // only to Admin + HR Manager). Returns every certificate by design; there is
  // no employee self-service list — recipients receive their own via email.
  async list(query: ListCertificatesQuery) {
    const where: Prisma.CertificateWhereInput = {};
    if (query.recipientId) where.recipientId = query.recipientId;
    if (query.status) where.status = query.status;

    const [data, total] = await certificatesRepository.list(
      where,
      (query.page - 1) * query.limit,
      query.limit,
    );
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  // Generate the PDF, store it privately, persist the record, and email the
  // recipient a download link. The email is best-effort and never fails the
  // request (delivery also requires the configured certificate email template).
  async createAndIssue(actorId: string, input: CreateCertificateInput) {
    const recipient = await prisma.user.findUnique({
      where: { id: input.recipientId },
      select: { id: true, name: true, email: true },
    });
    if (!recipient) throw new BadRequestException("Recipient not found");

    const issuer = await prisma.user.findUnique({
      where: { id: actorId },
      select: { name: true },
    });

    // Normalize signatories to a concrete shape (Zod defaults leave the
    // inferred props optional).
    const signatories = (input.signatories ?? []).map((s) => ({
      name: s.name ?? "",
      title: s.title ?? "",
    }));

    const pdf = await buildCertificatePdf({
      recipientName: recipient.name,
      title: input.title,
      message: input.message,
      type: input.type,
      issuedDate: new Date(),
      signatories,
    });

    const uploaded = await uploadFile(STORAGE_BUCKETS.DOCUMENTS, actorId, {
      buffer: pdf,
      originalName: `certificate-${recipient.id}.pdf`,
      mimeType: "application/pdf",
      size: pdf.length,
    });

    const cert = await certificatesRepository.create({
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      title: input.title,
      message: input.message ?? null,
      type: input.type,
      signatories,
      fileUrl: uploaded.url,
      status: "issued",
      issuedById: actorId,
      issuedAt: new Date(),
    });

    try {
      const downloadUrl = await createSignedUrl(
        uploaded.bucket,
        uploaded.path,
        DOWNLOAD_TTL_EMAIL,
      );
      const email = certificateIssuedEmail({
        recipientName: recipient.name,
        title: input.title,
        message: input.message ?? "",
        issuerName: issuer?.name ?? "Manut",
        downloadUrl,
      });
      void sendEmail({ to: recipient.email, ...email });
    } catch (err) {
      logger.error("Failed to email issued certificate", {
        error: err,
        certificateId: cert.id,
      });
    }

    return cert;
  }

  async getDownloadUrl(
    id: string,
    actorId: string,
    actorPermissions: string[],
  ) {
    const cert = await certificatesRepository.findById(id);
    if (!cert) throw new NotFoundException("Certificate not found");

    const canViewAll =
      actorPermissions.includes(PERMISSIONS.CERTIFICATE_READ) ||
      actorPermissions.includes(PERMISSIONS.CERTIFICATE_MANAGE);
    if (cert.recipientId !== actorId && !canViewAll) {
      throw new ForbiddenException("You cannot access this certificate");
    }
    if (!cert.fileUrl) {
      throw new NotFoundException("Certificate file is not available");
    }

    const parsed = parseTrustedStorageUrl(cert.fileUrl, [
      STORAGE_BUCKETS.DOCUMENTS,
    ]);
    if (!parsed) {
      throw new BadRequestException("Certificate file URL is invalid");
    }
    const url = await createSignedUrl(
      parsed.bucket,
      parsed.path,
      DOWNLOAD_TTL_PORTAL,
    );
    return { url };
  }

  async remove(id: string) {
    const cert = await certificatesRepository.findById(id);
    if (!cert) throw new NotFoundException("Certificate not found");

    // Best-effort: remove the stored PDF so deleting a record doesn't orphan
    // a file in the bucket. Never block the delete on storage cleanup.
    if (cert.fileUrl) {
      const parsed = parseTrustedStorageUrl(cert.fileUrl, [
        STORAGE_BUCKETS.DOCUMENTS,
      ]);
      if (parsed) {
        try {
          await deleteFile(parsed.bucket, parsed.path);
        } catch (err) {
          logger.error("Failed to delete certificate file from storage", {
            error: err,
            certificateId: id,
          });
        }
      }
    }

    await certificatesRepository.delete(id);
    return { success: true };
  }
}

export const certificatesService = new CertificatesService();
