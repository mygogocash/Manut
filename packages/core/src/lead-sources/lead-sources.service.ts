import type {
  CreateLeadSourceInput,
  ListLeadSourcesQuery,
  UpdateLeadSourceInput,
} from "@nexora/contracts/modules/lead-sources/lead-sources.validation";
import type { Db } from "@nexora/db";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import * as repo from "./lead-sources.repository";

export async function list(db: Db, query: ListLeadSourcesQuery) {
  return repo.list(db, query.includeInactive ?? false);
}

export async function create(db: Db, input: CreateLeadSourceInput) {
  const dup = await repo.findByCode(db, input.code);
  if (dup) throw new ConflictException(`A lead source with code "${input.code}" already exists.`);
  return repo.create(db, {
    code: input.code,
    label: input.label,
    sortOrder: input.sortOrder ?? 100,
  });
}

export async function update(db: Db, id: string, input: UpdateLeadSourceInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Lead source not found");
  if (existing.isSystem && input.label !== undefined) {
    throw new ForbiddenException(
      "System lead sources cannot be relabeled. Deactivate and create a custom replacement.",
    );
  }
  return repo.update(db, id, {
    ...(input.label !== undefined && { label: input.label }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Lead source not found");
  if (existing.isSystem) {
    throw new ForbiddenException(
      "System lead sources cannot be deleted. Use the deactivate toggle instead.",
    );
  }
  const inUse = await repo.countLeadsBySource(db, existing.code);
  if (inUse > 0) {
    throw new BadRequestException(
      `This source is referenced by ${inUse} ${inUse === 1 ? "lead" : "leads"}. Deactivate it instead of deleting.`,
    );
  }
  await repo.remove(db, id);
}
