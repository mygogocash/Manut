import { PERMISSIONS } from "@nexora/contracts";
import type { Db } from "@nexora/db";
import { eq } from "drizzle-orm";
import { schema } from "@nexora/db";
import type {
  CreatePolicyInput,
  ListPolicyQuery,
  UpdatePolicyInput,
} from "@nexora/contracts/modules/policies/policies.validation";
import { NotFoundException } from "../http-exception";
import * as repo from "./policies.repository";

export async function listForUser(
  db: Db,
  userId: string,
  userPermissions: string[],
  query: ListPolicyQuery,
) {
  const canManage = userPermissions.includes(PERMISSIONS.POLICY_MANAGE);
  let entityIds: string[] | undefined;
  if (!canManage) {
    const [user] = await db
      .select({ entityId: schema.users.entityId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    entityIds = user?.entityId ? [user.entityId] : [];
  } else if (query.entityId) {
    entityIds = [query.entityId];
  }

  return repo.findAll(db, {
    ...(query.category !== undefined && { category: query.category }),
    ...(entityIds !== undefined && { entityIds }),
    includeInactive: canManage ? query.includeInactive === true : false,
    ...(query.q !== undefined && { q: query.q }),
  });
}

export async function getById(db: Db, id: string) {
  const policy = await repo.findById(db, id);
  if (!policy) throw new NotFoundException("Policy not found");
  return policy;
}

/**
 * Until R2 signed downloads land with uploads, return the stored URL.
 * Private-bucket policies will need a Worker R2 signed URL later.
 */
export async function getDownloadUrl(db: Db, id: string) {
  const policy = await getById(db, id);
  return { url: policy.fileUrl };
}

export async function create(db: Db, input: CreatePolicyInput, uploadedById: string) {
  return repo.create(db, {
    title: input.title,
    category: input.category,
    description: input.description ?? null,
    fileUrl: input.fileUrl,
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    fileSize: input.fileSize ?? null,
    version: input.version ?? null,
    effectiveDate: input.effectiveDate && input.effectiveDate !== "" ? input.effectiveDate : null,
    entityId: input.entityId ?? null,
    isActive: input.isActive ?? true,
    uploadedById,
  });
}

export async function update(db: Db, id: string, input: UpdatePolicyInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Policy not found");
  return repo.update(db, id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.description !== undefined && { description: input.description ?? null }),
    ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl }),
    ...(input.fileName !== undefined && { fileName: input.fileName }),
    ...(input.mimeType !== undefined && { mimeType: input.mimeType ?? null }),
    ...(input.fileSize !== undefined && { fileSize: input.fileSize ?? null }),
    ...(input.version !== undefined && { version: input.version ?? null }),
    ...(input.effectiveDate !== undefined && {
      effectiveDate: input.effectiveDate && input.effectiveDate !== "" ? input.effectiveDate : null,
    }),
    ...(input.entityId !== undefined && { entityId: input.entityId ?? null }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Policy not found");
  await repo.remove(db, id);
  return { success: true };
}
