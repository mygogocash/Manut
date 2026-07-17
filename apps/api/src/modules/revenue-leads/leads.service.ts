import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { staleLeadDigestEmail } from "@/infrastructure/email/templates";
import {
  actorFromId,
  trackLeadConverted,
  trackLeadCreatedServer,
} from "@/lib/events";
import { PORTAL_URL } from "@/lib/portal-url";
import { leadRepository } from "@/modules/revenue-leads/leads.repository";
import {
  type ConvertLeadInput,
  type CreateLeadInput,
  type DisqualifyLeadInput,
  type ListLeadsQuery,
  type ListStaleLeadsQuery,
  STALE_LEAD_DAYS,
  type UpdateLeadInput,
} from "@/modules/revenue-leads/leads.validation";
import {
  type OpportunityStage,
  STAGE_PROBABILITY_DEFAULTS,
} from "@/modules/revenue-opportunities/opportunities.constants";

export class LeadService {
  // Default crm:read is owner-only; crm:team-read widens access to all.
  // Team-shared semantics (manager hierarchy) is a follow-up; for v2 this is
  // the simplest correct interpretation: own vs all.
  async list(userId: string, permissions: string[], query: ListLeadsQuery) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes("sales-revenue:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await leadRepository.findMany(
      { ...filters, ownerScope },
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Daily digest email job. For each owner with at
  // least one stale lead, send one summary email with up to N rows
  // inline + a count of any hidden tail. Fired by /api/cron/stale-leads-
  // digest (caller is responsible for the daily schedule). Returns
  // counters so the cron caller can log delivery stats.
  async processStaleLeadDigest(opts: { rowsPerEmail?: number } = {}) {
    const rowsPerEmail = opts.rowsPerEmail ?? 10;
    const cutoff = new Date(Date.now() - STALE_LEAD_DAYS * 86_400_000);

    // Group stale leads by owner. Pull the full set in one round-trip;
    // workspaces with thousands of stale rows can paginate later.
    const stale = await prisma.revenueLead.findMany({
      where: {
        status: { in: ["new", "contacted"] },
        createdAt: { lt: cutoff },
        activities: { none: { occurredAt: { gte: cutoff } } },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (stale.length === 0) {
      return { ownersNotified: 0, emailsSent: 0, totalLeads: 0 };
    }

    // Bucket by owner.
    const byOwner = new Map<
      string,
      {
        owner: { id: string; name: string; email: string };
        leads: typeof stale;
      }
    >();
    for (const lead of stale) {
      if (!lead.owner) continue;
      const bucket = byOwner.get(lead.owner.id);
      if (bucket) {
        bucket.leads.push(lead);
      } else {
        byOwner.set(lead.owner.id, { owner: lead.owner, leads: [lead] });
      }
    }

    let emailsSent = 0;
    const portalUrl = PORTAL_URL;

    for (const [, bucket] of byOwner) {
      const totalCount = bucket.leads.length;
      const visible = bucket.leads.slice(0, rowsPerEmail);
      const hiddenCount = totalCount - visible.length;

      const email = staleLeadDigestEmail({
        ownerName: bucket.owner.name,
        thresholdDays: STALE_LEAD_DAYS,
        totalCount,
        rows: visible.map((l) => ({
          company: l.company,
          contactName: `${l.firstName} ${l.lastName}`.trim(),
          daysSinceCreated: Math.floor(
            (Date.now() - new Date(l.createdAt).getTime()) / 86_400_000,
          ),
          status: l.status,
        })),
        hiddenCount,
        portalUrl: `${portalUrl}/sales`,
      });

      try {
        await sendEmail({ to: bucket.owner.email, ...email });
        emailsSent += 1;
      } catch (err) {
        logger.error("staleLeadDigest send failed", {
          ownerId: bucket.owner.id,
          err,
        });
      }
    }

    return {
      ownersNotified: byOwner.size,
      emailsSent,
      totalLeads: stale.length,
    };
  }

  // Stale-lead surface for managers + reps. Same own/team-read
  // scoping as `list`. Cutoff is computed here (not by the caller) so a
  // single source of truth applies across the API and the future digest job.
  async listStale(
    userId: string,
    permissions: string[],
    query: ListStaleLeadsQuery,
  ) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes("sales-revenue:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];

    const cutoff = new Date(Date.now() - STALE_LEAD_DAYS * 86_400_000);

    const { data, total } = await leadRepository.findStale(
      { ...filters, ownerScope, cutoff },
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      // Threshold is part of the response body (not meta) so it stays
      // conformant with ApiPagination on the client. Surface it for the UI
      // without forcing a duplicated constant on the web side.
      thresholdDays: STALE_LEAD_DAYS,
    };
  }

  async getById(id: string, userId: string, permissions: string[]) {
    const lead = await leadRepository.findById(id);
    if (!lead) throw new NotFoundException("Lead not found");

    const canSeeAll = permissions.includes("sales-revenue:team-read");
    if (!canSeeAll && lead.ownerId !== userId) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }

  async create(ownerId: string, input: CreateLeadInput) {
    await this.assertSourceActive(input.source);
    const created = await leadRepository.create({
      company: input.company,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      title: input.title,
      source: input.source,
      status: input.status,
      notes: input.notes,
      owner: { connect: { id: ownerId } },
    });

    try {
      const trackingActor = await actorFromId(ownerId);
      if (trackingActor) {
        trackLeadCreatedServer(trackingActor, { source_code: input.source });
      }
    } catch {
      // analytics is best-effort
    }

    return created;
  }

  // Source codes used to be a fixed Zod enum; now they
  // resolve against the workspace-admin-managed lead_sources table.
  // Reps can't pick a deactivated row on net-new leads, but existing
  // rows that reference a now-deactivated source stay valid (their
  // historical attribution is preserved on the row itself).
  private async assertSourceActive(code: string) {
    const row = await prisma.revenueLeadSource.findUnique({
      where: { code },
      select: { isActive: true },
    });
    if (!row || !row.isActive) {
      throw new BadRequestException(
        `Source "${code}" is not an active lead source.`,
      );
    }
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateLeadInput,
  ) {
    const existing = await this.getById(id, userId, permissions);

    if (existing.status === "converted" || existing.status === "disqualified") {
      throw new BadRequestException(
        `Cannot edit a ${existing.status} lead. Reopen via convert/disqualify endpoints.`,
      );
    }

    if (input.source !== undefined && input.source !== existing.source) {
      await this.assertSourceActive(input.source);
    }

    return leadRepository.update(id, {
      ...(input.company !== undefined && { company: input.company }),
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
      ...(input.email !== undefined && { email: input.email || null }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.title !== undefined && { title: input.title || null }),
      ...(input.source !== undefined && { source: input.source }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
    });
  }

  async disqualify(
    id: string,
    userId: string,
    permissions: string[],
    input: DisqualifyLeadInput,
  ) {
    const existing = await this.getById(id, userId, permissions);

    if (existing.status === "converted") {
      throw new BadRequestException(
        "Cannot disqualify a lead that has already been converted.",
      );
    }
    if (existing.status === "disqualified") {
      throw new BadRequestException("Lead is already disqualified.");
    }

    return leadRepository.update(id, {
      status: "disqualified",
      disqualifyReason: input.reason,
    });
  }

  async delete(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return leadRepository.delete(id);
  }

  // Lead conversion. Single Prisma transaction:
  //   1. Resolve / create Account with domain/name dedupe
  //   2. Resolve / create Contact under that Account (auto-primary on first)
  //   3. Create Opportunity with stage probability defaults
  //   4. Update Lead → status=converted, convertedOpportunityId, convertedAt
  //   5. Re-target Lead activities to the new Opportunity (keep leadId for audit)
  async convert(
    id: string,
    userId: string,
    permissions: string[],
    input: ConvertLeadInput,
  ) {
    const lead = await this.getById(id, userId, permissions);

    if (lead.status === "converted") {
      throw new BadRequestException("Lead is already converted.");
    }
    if (lead.status === "disqualified") {
      throw new BadRequestException("Cannot convert a disqualified lead.");
    }

    // Owner stays unless caller has crm:reassign and explicitly
    // overrides. A non-reassign caller passing any ownerId (even their own)
    // is rejected so we can't accidentally normalise away an audit signal.
    let effectiveOwnerId = lead.ownerId;
    if (input.ownerId !== undefined) {
      if (!permissions.includes("sales-revenue:reassign")) {
        throw new ForbiddenException(
          "Changing owner on convert requires the crm:reassign permission.",
        );
      }
      effectiveOwnerId = input.ownerId;
    }

    return prisma
      .$transaction(async (tx) => {
        // ── 1. Resolve account ──────────────────────────────────────────────
        let accountId: string;

        if (input.accountId) {
          const existing = await tx.revenueAccount.findUnique({
            where: { id: input.accountId },
            select: { id: true, ownerId: true },
          });
          if (!existing) {
            throw new NotFoundException("Account not found");
          }
          const canSeeAll = permissions.includes("sales-revenue:team-read");
          if (!canSeeAll && existing.ownerId !== userId) {
            throw new NotFoundException("Account not found");
          }
          accountId = existing.id;
        } else {
          // newAccount or default-from-lead. Both go through the same
          // dedupe path so callers cannot bypass it via the convert endpoint.
          const newAccount = input.newAccount ?? { name: lead.company };

          if (newAccount.domain) {
            const dup = await tx.revenueAccount.findUnique({
              where: { domain: newAccount.domain },
              select: { id: true },
            });
            if (dup) {
              throw new ConflictException(
                `An account with domain "${newAccount.domain}" already exists (id: ${dup.id}).`,
              );
            }
          } else if (!input.confirmCreate) {
            const candidate = await tx.revenueAccount.findFirst({
              where: { name: { equals: newAccount.name, mode: "insensitive" } },
              select: { id: true, name: true },
            });
            if (candidate) {
              throw new ConflictException(
                `An account named "${candidate.name}" already exists (id: ${candidate.id}). Pass accountId to attach or confirmCreate=true to create a separate account.`,
              );
            }
          }

          const created = await tx.revenueAccount.create({
            data: {
              name: newAccount.name,
              domain: newAccount.domain,
              industry: newAccount.industry,
              size: newAccount.size,
              country: newAccount.country,
              website: newAccount.website,
              owner: { connect: { id: effectiveOwnerId } },
            },
            select: { id: true },
          });
          accountId = created.id;
        }

        // ── 2. Resolve contact ──────────────────────────────────────────────
        let contactId: string;

        if (input.contactId) {
          const existing = await tx.revenueContact.findUnique({
            where: { id: input.contactId },
            select: { id: true, accountId: true },
          });
          if (!existing) {
            throw new NotFoundException("Contact not found");
          }
          if (existing.accountId !== accountId) {
            throw new BadRequestException(
              "Contact does not belong to the resolved account.",
            );
          }
          contactId = existing.id;
        } else {
          const seed = input.newContact ?? {
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email ?? undefined,
            phone: lead.phone ?? undefined,
            title: lead.title ?? undefined,
          };

          const existingCount = await tx.revenueContact.count({
            where: { accountId },
          });
          const isPrimary = existingCount === 0;

          const created = await tx.revenueContact.create({
            data: {
              account: { connect: { id: accountId } },
              firstName: seed.firstName,
              lastName: seed.lastName,
              email: seed.email,
              phone: seed.phone,
              title: seed.title,
              isPrimary,
            },
            select: { id: true },
          });
          contactId = created.id;
        }

        // ── 3. Create opportunity ───────────────────────────────────────────
        const stage = input.opportunity.stage as OpportunityStage;
        const probabilityCustom = input.opportunity.probability !== undefined;
        const probability = probabilityCustom
          ? input.opportunity.probability!
          : STAGE_PROBABILITY_DEFAULTS[stage];

        const opportunity = await tx.revenueOpportunity.create({
          data: {
            name: input.opportunity.name,
            account: { connect: { id: accountId } },
            contact: { connect: { id: contactId } },
            stage,
            value: input.opportunity.value,
            currency: input.opportunity.currency,
            probability,
            probabilityCustom,
            closeDate: input.opportunity.closeDate
              ? new Date(input.opportunity.closeDate)
              : undefined,
            type: input.opportunity.type,
            owner: { connect: { id: effectiveOwnerId } },
          },
        });

        // ── 4. Mark lead converted ──────────────────────────────────────────
        const updatedLead = await tx.revenueLead.update({
          where: { id },
          data: {
            status: "converted",
            convertedOpportunityId: opportunity.id,
            convertedAt: new Date(),
          },
        });

        // ── 5. Re-target lead activities to the new opportunity ─────────────
        // Keep `leadId` populated so the audit trail still ties activities to
        // the originating lead. Only flip `opportunityId` so they show up in
        // the opportunity detail view too.
        await tx.revenueActivity.updateMany({
          where: { leadId: id, opportunityId: null },
          data: { opportunityId: opportunity.id },
        });

        return {
          lead: updatedLead,
          accountId,
          contactId,
          opportunity,
        };
      })
      .then(async (result) => {
        try {
          const trackingActor = await actorFromId(userId);
          if (trackingActor) {
            trackLeadConverted(trackingActor, {
              deal_id: result.opportunity.id,
            });
          }
        } catch {
          // analytics is best-effort
        }
        return result;
      });
  }
}

export const leadService = new LeadService();
