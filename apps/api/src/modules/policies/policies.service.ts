import { PERMISSIONS } from "@/common/constants/permissions";
import { NotFoundException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import {
  createSignedUrl,
  requireRegisteredStorageUrl,
  STORAGE_BUCKETS,
} from "@/infrastructure/storage/supabase-storage";
import { policiesRepository } from "@/modules/policies/policies.repository";
import type {
  CreatePolicyInput,
  ListPolicyQuery,
  UpdatePolicyInput,
} from "@/modules/policies/policies.validation";

const SIGNED_URL_TTL_SECONDS = 5 * 60;

export class PoliciesService {
  /**
   * Employee-facing list. Scopes by the caller's entity so India staff
   * don't see Thailand-only handbooks. HR (`policy:manage`) sees every
   * policy regardless of entity.
   */
  async listForUser(
    userId: string,
    userPermissions: string[],
    query: ListPolicyQuery,
  ) {
    const canManage = userPermissions.includes(PERMISSIONS.POLICY_MANAGE);

    let entityIds: string[] | undefined;
    if (!canManage) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { entityId: true },
      });
      entityIds = user?.entityId ? [user.entityId] : [];
    } else if (query.entityId) {
      entityIds = [query.entityId];
    }

    return policiesRepository.findAll({
      ...(query.category !== undefined && { category: query.category }),
      ...(entityIds !== undefined && { entityIds }),
      // Only HR opts into the "include retired policies" view; everyone
      // else gets active-only no matter what they pass.
      includeInactive: canManage ? query.includeInactive === true : false,
      ...(query.q !== undefined && { q: query.q }),
    });
  }

  async getById(id: string, userId: string, userPermissions: string[]) {
    const policy = await policiesRepository.findById(id);
    if (!policy) throw new NotFoundException("Policy not found");

    if (!userPermissions.includes(PERMISSIONS.POLICY_MANAGE)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { entityId: true },
      });
      const visibleToEntity =
        policy.entityId === null || policy.entityId === user?.entityId;
      if (!policy.isActive || !visibleToEntity) {
        throw new NotFoundException("Policy not found");
      }
    }
    return policy;
  }

  async getDownloadUrl(id: string, userId: string, userPermissions: string[]) {
    const policy = await this.getById(id, userId, userPermissions);
    const parsed = await requireRegisteredStorageUrl(policy.fileUrl, {
      allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
      purpose: "company-policy",
    });
    const url = await createSignedUrl(
      parsed.bucket,
      parsed.path,
      SIGNED_URL_TTL_SECONDS,
    );
    return { url };
  }

  async create(input: CreatePolicyInput, uploadedById: string) {
    await requireRegisteredStorageUrl(input.fileUrl, {
      allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
      purpose: "company-policy",
      uploadedBy: uploadedById,
    });
    return policiesRepository.create({
      title: input.title,
      category: input.category,
      description: input.description ?? null,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      fileSize: input.fileSize ?? null,
      version: input.version ?? null,
      effectiveDate:
        input.effectiveDate && input.effectiveDate !== ""
          ? new Date(input.effectiveDate)
          : null,
      entityId: input.entityId ?? null,
      isActive: input.isActive ?? true,
      uploadedById,
    });
  }

  async update(id: string, input: UpdatePolicyInput, actorId: string) {
    const existing = await policiesRepository.findById(id);
    if (!existing) throw new NotFoundException("Policy not found");
    if (input.fileUrl !== undefined) {
      await requireRegisteredStorageUrl(input.fileUrl, {
        allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
        purpose: "company-policy",
        uploadedBy: actorId,
      });
    }
    return policiesRepository.update(id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.description !== undefined && {
        description: input.description ?? null,
      }),
      ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl }),
      ...(input.fileName !== undefined && { fileName: input.fileName }),
      ...(input.mimeType !== undefined && {
        mimeType: input.mimeType ?? null,
      }),
      ...(input.fileSize !== undefined && {
        fileSize: input.fileSize ?? null,
      }),
      ...(input.version !== undefined && { version: input.version ?? null }),
      ...(input.effectiveDate !== undefined && {
        effectiveDate:
          input.effectiveDate && input.effectiveDate !== ""
            ? new Date(input.effectiveDate)
            : null,
      }),
      ...(input.entityId !== undefined && { entityId: input.entityId ?? null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }

  async delete(id: string) {
    const existing = await policiesRepository.findById(id);
    if (!existing) throw new NotFoundException("Policy not found");
    await policiesRepository.delete(id);
    return { success: true };
  }
}

export const policiesService = new PoliciesService();
