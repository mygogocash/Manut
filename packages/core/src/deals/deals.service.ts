import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateDealInput,
  ListDealsQuery,
  UpdateDealInput,
} from "@nexora/contracts/modules/deals/deals.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import * as repo from "./deals.repository";

export async function list(db: Db, userId: string, permissions: string[], query: ListDealsQuery) {
  const { page, limit, ...filters } = query;
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];

  const { data, total } = await repo.findMany(db, { ...filters, ownerScope }, page, limit);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  const deal = await repo.findById(db, id);
  if (!deal) throw new NotFoundException("Deal not found");

  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  if (!canSeeAll && deal.ownerId !== userId) {
    throw new NotFoundException("Deal not found");
  }
  return deal;
}

export async function create(db: Db, ownerId: string, input: CreateDealInput) {
  return repo.create(db, {
    company: input.company,
    contact: input.contact ?? null,
    value: String(input.value),
    stage: input.stage ?? "lead",
    probability: input.probability ?? 10,
    type: input.type ?? null,
    country: input.country ?? null,
    closeDate: input.closeDate ?? null,
    notes: input.notes ?? null,
    partnerId: input.partnerId ?? null,
    ownerId,
  });
}

export async function update(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: UpdateDealInput,
) {
  await getById(db, id, userId, permissions);

  return repo.update(db, id, {
    ...(input.company !== undefined && { company: input.company }),
    ...(input.contact !== undefined && { contact: input.contact || null }),
    ...(input.value !== undefined && { value: String(input.value) }),
    ...(input.stage !== undefined && { stage: input.stage }),
    ...(input.probability !== undefined && { probability: input.probability }),
    ...(input.type !== undefined && { type: input.type || null }),
    ...(input.country !== undefined && { country: input.country || null }),
    ...(input.closeDate !== undefined && { closeDate: input.closeDate || null }),
    ...(input.notes !== undefined && { notes: input.notes || null }),
    ...(input.partnerId !== undefined && { partnerId: input.partnerId || null }),
  });
}

export async function remove(db: Db, id: string, userId: string, permissions: string[]) {
  await getById(db, id, userId, permissions);
  await repo.remove(db, id);
}

export async function getPipelineSummary(db: Db, userId: string, permissions: string[]) {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];
  return repo.pipelineSummary(db, ownerScope);
}
