import type { Request } from "express";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logAudit } from "@/infrastructure/audit/audit.service";
import {
  marketingCampaignsRepository as repo,
  type MktCampaignListRow,
  type MktCampaignWithRelations,
} from "@/modules/marketing-campaigns/marketing-campaigns.repository";
import type {
  CampaignQuery,
  CreateCampaignInput,
  CreateCreativeInput,
  CreateLeverInput,
  CreatePredictionInput,
  SetLeversInput,
  UpdateCampaignInput,
  UpdateLeverInput,
} from "@/modules/marketing-campaigns/marketing-campaigns.validation";

const RESOURCE = "marketing-campaign";

function parseDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return new Date(`${v}T00:00:00.000Z`);
}

function listDTO(c: MktCampaignListRow) {
  return {
    id: c.id,
    name: c.name,
    campaignDate: c.campaignDate.toISOString(),
    hours: c.hours,
    status: c.status,
    country: c.country,
    partnerId: c.partnerId,
    product: c.product,
    channel: c.channel,
    campaignType: c.campaignType,
    owner: c.owner,
    budget: c.budget === null ? null : Number(c.budget),
    currency: c.currency,
    expectedReach: c.expectedReach,
    actualReach: c.actualReach,
    levers: c.levers.map((l) => ({ id: l.lever.id, name: l.lever.name })),
    creativeCount: c._count.creatives,
    predictionCount: c._count.predictions,
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

function detailDTO(c: MktCampaignWithRelations) {
  return {
    id: c.id,
    name: c.name,
    campaignDate: c.campaignDate.toISOString(),
    hours: c.hours,
    ownerId: c.ownerId,
    owner: c.owner,
    status: c.status,
    country: c.country,
    partnerId: c.partnerId,
    product: c.product,
    channel: c.channel,
    campaignType: c.campaignType,
    objective: c.objective,
    targetAudience: c.targetAudience,
    leversSequence: c.leversSequence,
    copyText: c.copyText,
    expectedReach: c.expectedReach,
    actualReach: c.actualReach,
    budget: c.budget === null ? null : Number(c.budget),
    currency: c.currency,
    notes: c.notes,
    createdBy: c.createdBy,
    levers: c.levers.map((l) => ({ id: l.lever.id, name: l.lever.name })),
    creatives: c.creatives.map((cr) => ({
      id: cr.id,
      version: cr.version,
      kind: cr.kind,
      source: cr.source,
      name: cr.name,
      url: cr.url,
      mimeType: cr.mimeType,
      size: cr.size,
      uploadedBy: cr.uploadedBy,
      createdAt: cr.createdAt.toISOString(),
    })),
    predictions: c.predictions.map((p) => ({
      id: p.id,
      format: p.format,
      name: p.name,
      url: p.url,
      mimeType: p.mimeType,
      size: p.size,
      uploadedBy: p.uploadedBy,
      createdAt: p.createdAt.toISOString(),
    })),
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export class MarketingCampaignsService {
  // ── Campaigns ──
  async list(query: CampaignQuery) {
    const where: Parameters<typeof repo.count>[0] = {};
    if (query.status) where.status = query.status;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { product: { contains: query.search, mode: "insensitive" } },
        { country: { contains: query.search, mode: "insensitive" } },
        { channel: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const from = parseDate(query.from);
    const to = parseDate(query.to);
    if (from || to) {
      where.campaignDate = {};
      if (from) where.campaignDate.gte = from;
      if (to) where.campaignDate.lte = to;
    }
    // Archive is orthogonal to status: the default view shows active campaigns
    // only; the Archived tab (archived=true) shows the archived ones. Applied
    // to BOTH the rows query and the count so pagination stays consistent.
    where.archivedAt = query.archived ? { not: null } : null;
    const [rows, total] = await Promise.all([
      repo.list({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      repo.count(where),
    ]);
    return {
      data: rows.map(listDTO),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async getById(id: string) {
    const row = await repo.findById(id);
    if (!row) throw new NotFoundException("Campaign not found");
    return { data: detailDTO(row) };
  }

  private async assertLeverIds(leverIds: string[]) {
    if (leverIds.length === 0) return;
    const found = await repo.validLeverIds(leverIds);
    if (found.length !== new Set(leverIds).size) {
      throw new BadRequestException("One or more levers are invalid");
    }
  }

  async create(input: CreateCampaignInput, actorId: string, req?: Request) {
    const leverIds = input.leverIds ?? [];
    await this.assertLeverIds(leverIds);
    const row = await repo.create({
      name: input.name,
      campaignDate: parseDate(input.campaignDate)!,
      hours: input.hours ?? null,
      ownerId: input.ownerId ?? null,
      status: input.status,
      country: input.country ?? null,
      partnerId: input.partnerId ?? null,
      product: input.product ?? null,
      channel: input.channel ?? null,
      campaignType: input.campaignType ?? null,
      objective: input.objective ?? null,
      targetAudience: input.targetAudience ?? null,
      leversSequence: input.leversSequence ?? null,
      copyText: input.copyText ?? null,
      expectedReach: input.expectedReach ?? null,
      actualReach: input.actualReach ?? null,
      budget: input.budget ?? null,
      currency: input.currency,
      notes: input.notes ?? null,
      createdById: actorId,
    });
    if (leverIds.length > 0) {
      await repo.setCampaignLevers(row.id, leverIds);
    }
    void logAudit({
      action: "create",
      resource: RESOURCE,
      resourceId: row.id,
      details: { name: input.name },
      req,
    });
    return this.getById(row.id);
  }

  async update(
    id: string,
    input: UpdateCampaignInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundException("Campaign not found");
    await repo.update(id, {
      ...("name" in input ? { name: input.name } : {}),
      ...("campaignDate" in input
        ? { campaignDate: parseDate(input.campaignDate)! }
        : {}),
      ...("hours" in input ? { hours: input.hours ?? null } : {}),
      ...("ownerId" in input ? { ownerId: input.ownerId ?? null } : {}),
      ...("status" in input ? { status: input.status } : {}),
      ...("country" in input ? { country: input.country ?? null } : {}),
      ...("partnerId" in input ? { partnerId: input.partnerId ?? null } : {}),
      ...("product" in input ? { product: input.product ?? null } : {}),
      ...("channel" in input ? { channel: input.channel ?? null } : {}),
      ...("campaignType" in input
        ? { campaignType: input.campaignType ?? null }
        : {}),
      ...("objective" in input ? { objective: input.objective ?? null } : {}),
      ...("targetAudience" in input
        ? { targetAudience: input.targetAudience ?? null }
        : {}),
      ...("leversSequence" in input
        ? { leversSequence: input.leversSequence ?? null }
        : {}),
      ...("copyText" in input ? { copyText: input.copyText ?? null } : {}),
      ...("expectedReach" in input
        ? { expectedReach: input.expectedReach ?? null }
        : {}),
      ...("actualReach" in input
        ? { actualReach: input.actualReach ?? null }
        : {}),
      ...("budget" in input ? { budget: input.budget ?? null } : {}),
      ...("currency" in input ? { currency: input.currency } : {}),
      ...("notes" in input ? { notes: input.notes ?? null } : {}),
    });
    if (input.leverIds) {
      await this.assertLeverIds(input.leverIds);
      await repo.setCampaignLevers(id, input.leverIds);
    }
    void logAudit({
      action: "update",
      resource: RESOURCE,
      resourceId: id,
      details: { ...input },
      req,
    });
    return this.getById(id);
  }

  async remove(id: string, _actorId: string, req?: Request) {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundException("Campaign not found");
    await repo.delete(id);
    void logAudit({
      action: "delete",
      resource: RESOURCE,
      resourceId: id,
      details: { name: existing.name },
      req,
    });
    return { data: { id } };
  }

  // Reversible hide, orthogonal to `status`. Gated at the route by the module's
  // existing update permission (same guard as update/delete). Idempotent:
  // re-archiving keeps the original archive time.
  async archive(id: string, _actorId: string, req?: Request) {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundException("Campaign not found");
    await repo.update(id, {
      archivedAt: existing.archivedAt ?? new Date(),
    });
    void logAudit({
      action: "archive",
      resource: RESOURCE,
      resourceId: id,
      details: { name: existing.name },
      req,
    });
    return this.getById(id);
  }

  async unarchive(id: string, _actorId: string, req?: Request) {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundException("Campaign not found");
    await repo.update(id, { archivedAt: null });
    void logAudit({
      action: "unarchive",
      resource: RESOURCE,
      resourceId: id,
      details: { name: existing.name },
      req,
    });
    return this.getById(id);
  }

  async setLevers(
    id: string,
    input: SetLeversInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundException("Campaign not found");
    await this.assertLeverIds(input.leverIds);
    await repo.setCampaignLevers(id, input.leverIds);
    void logAudit({
      action: "update",
      resource: RESOURCE,
      resourceId: id,
      details: { levers: input.leverIds },
      req,
    });
    return this.getById(id);
  }

  // ── Levers config (admin-configurable) ──
  async listLevers(activeOnly: boolean) {
    return { data: await repo.listLevers(activeOnly) };
  }
  async createLever(input: CreateLeverInput, _actorId: string, req?: Request) {
    const row = await repo.createLever({
      name: input.name,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    });
    void logAudit({
      action: "create",
      resource: `${RESOURCE}-lever`,
      resourceId: row.id,
      details: { name: input.name },
      req,
    });
    return { data: row };
  }
  async updateLever(
    id: string,
    input: UpdateLeverInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await repo.findLever(id);
    if (!existing) throw new NotFoundException("Lever not found");
    const row = await repo.updateLever(id, {
      ...("name" in input ? { name: input.name } : {}),
      ...("isActive" in input ? { isActive: input.isActive } : {}),
      ...("sortOrder" in input ? { sortOrder: input.sortOrder } : {}),
    });
    void logAudit({
      action: "update",
      resource: `${RESOURCE}-lever`,
      resourceId: id,
      req,
    });
    return { data: row };
  }
  async deleteLever(id: string, _actorId: string, req?: Request) {
    const existing = await repo.findLever(id);
    if (!existing) throw new NotFoundException("Lever not found");
    await repo.deleteLever(id);
    void logAudit({
      action: "delete",
      resource: `${RESOURCE}-lever`,
      resourceId: id,
      req,
    });
    return { data: { id } };
  }

  // ── Creatives (versioned) ──
  async addCreative(
    campaignId: string,
    input: CreateCreativeInput,
    actorId: string,
    req?: Request,
  ) {
    const campaign = await repo.findById(campaignId);
    if (!campaign) throw new NotFoundException("Campaign not found");
    const agg = await repo.latestCreativeVersion(campaignId);
    const version = (agg._max.version ?? 0) + 1;
    const row = await repo.createCreative({
      campaignId,
      version,
      kind: input.kind,
      source: input.source,
      name: input.name,
      url: input.url,
      mimeType: input.mimeType ?? null,
      size: input.size ?? null,
      uploadedById: actorId,
    });
    void logAudit({
      action: "upload",
      resource: `${RESOURCE}-creative`,
      resourceId: row.id,
      details: { campaignId, kind: input.kind, source: input.source, version },
      req,
    });
    return { data: { ...row, createdAt: row.createdAt.toISOString() } };
  }

  async deleteCreative(id: string, _actorId: string, req?: Request) {
    const existing = await repo.findCreative(id);
    if (!existing) throw new NotFoundException("Creative not found");
    await repo.deleteCreative(id);
    void logAudit({
      action: "delete",
      resource: `${RESOURCE}-creative`,
      resourceId: id,
      details: { campaignId: existing.campaignId },
      req,
    });
    return { data: { id } };
  }

  // ── Predictions (history) ──
  async addPrediction(
    campaignId: string,
    input: CreatePredictionInput,
    actorId: string,
    req?: Request,
  ) {
    const campaign = await repo.findById(campaignId);
    if (!campaign) throw new NotFoundException("Campaign not found");
    const row = await repo.createPrediction({
      campaignId,
      format: input.format,
      name: input.name,
      url: input.url,
      mimeType: input.mimeType ?? null,
      size: input.size ?? null,
      uploadedById: actorId,
    });
    void logAudit({
      action: "upload",
      resource: `${RESOURCE}-prediction`,
      resourceId: row.id,
      details: { campaignId, format: input.format },
      req,
    });
    return { data: { ...row, createdAt: row.createdAt.toISOString() } };
  }

  async deletePrediction(id: string, _actorId: string, req?: Request) {
    const existing = await repo.findPrediction(id);
    if (!existing) throw new NotFoundException("Prediction not found");
    await repo.deletePrediction(id);
    void logAudit({
      action: "delete",
      resource: `${RESOURCE}-prediction`,
      resourceId: id,
      details: { campaignId: existing.campaignId },
      req,
    });
    return { data: { id } };
  }
}

export const marketingCampaignsService = new MarketingCampaignsService();
