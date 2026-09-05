import type {
  CampaignQuery,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@nexora/contracts/modules/marketing-campaigns/marketing-campaigns.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception.js";
import * as repo from "./marketing-campaigns.repository.js";

function mapCampaign<T extends { budget: string | null }>(c: T) {
  return { ...c, budget: c.budget === null ? null : Number(c.budget) };
}

export async function listLevers(db: Db, activeOnly = false) {
  const data = await repo.listLevers(db, activeOnly);
  return { data };
}

export async function listCampaigns(db: Db, query: CampaignQuery) {
  const { page, limit } = query;
  const { data, total } = await repo.listCampaigns(db, page, limit);
  return {
    data: data.map((c) => ({
      id: c.id,
      name: c.name,
      campaignDate: c.campaignDate,
      hours: c.hours,
      status: c.status,
      country: c.country,
      partnerId: c.partnerId,
      product: c.product,
      channel: c.channel,
      campaignType: c.campaignType,
      owner: c.ownerId ? { id: c.ownerId, name: c.ownerName ?? "" } : null,
      budget: c.budget === null ? null : Number(c.budget),
      currency: c.currency,
      expectedReach: c.expectedReach,
      actualReach: c.actualReach,
      archivedAt: c.archivedAt,
      createdAt: c.createdAt,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getCampaignById(db: Db, id: string) {
  const row = await repo.findCampaignById(db, id);
  if (!row) throw new NotFoundException("Campaign not found");
  return { data: mapCampaign(row) };
}

export async function createCampaign(db: Db, input: CreateCampaignInput, actorId: string) {
  const row = await repo.createCampaign(db, input, actorId);
  if (!row) throw new NotFoundException("Campaign not found after create");
  return { data: mapCampaign(row) };
}

export async function updateCampaign(db: Db, id: string, input: UpdateCampaignInput) {
  const existing = await repo.findCampaignById(db, id);
  if (!existing) throw new NotFoundException("Campaign not found");
  const row = await repo.updateCampaign(db, id, input);
  if (!row) throw new NotFoundException("Campaign not found");
  return { data: mapCampaign(row) };
}

export async function archiveCampaign(db: Db, id: string) {
  const existing = await repo.findCampaignById(db, id);
  if (!existing) throw new NotFoundException("Campaign not found");
  await repo.archiveCampaign(db, id);
  return { archived: true };
}
