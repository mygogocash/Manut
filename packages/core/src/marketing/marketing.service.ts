import type {
  CreateMarketingCampaignInput,
  MarketingCampaignQuery,
  UpdateMarketingCampaignInput,
} from "@nexora/contracts/modules/marketing/marketing.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception.js";
import * as repo from "./marketing.repository.js";

function normalizeUrl(value: string | null | undefined): string | null {
  if (value === undefined) return null;
  if (value === null || value.trim() === "") return null;
  return value;
}

export async function list(db: Db, query: MarketingCampaignQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string) {
  const row = await repo.findById(db, id);
  if (!row) throw new NotFoundException("Campaign not found");
  return row;
}

export async function create(db: Db, input: CreateMarketingCampaignInput, addedBy: string) {
  return repo.create(db, {
    title: input.title,
    campaignDate: input.campaignDate,
    hours: input.hours ?? null,
    leversPulled: input.leversPulled ?? null,
    copyDesign: input.copyDesign ?? null,
    predictionFileUrl: normalizeUrl(input.predictionFileUrl),
    predictionFileName: input.predictionFileName ?? null,
    status: input.status,
    addedBy,
  });
}

export async function update(db: Db, id: string, input: UpdateMarketingCampaignInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Campaign not found");
  return repo.update(db, id, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.campaignDate !== undefined ? { campaignDate: input.campaignDate } : {}),
    ...(input.hours !== undefined ? { hours: input.hours ?? null } : {}),
    ...(input.leversPulled !== undefined ? { leversPulled: input.leversPulled ?? null } : {}),
    ...(input.copyDesign !== undefined ? { copyDesign: input.copyDesign ?? null } : {}),
    ...(input.predictionFileUrl !== undefined ? { predictionFileUrl: normalizeUrl(input.predictionFileUrl) } : {}),
    ...(input.predictionFileName !== undefined ? { predictionFileName: input.predictionFileName ?? null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Campaign not found");
  await repo.remove(db, id);
}
