import { NotFoundException } from "@/common/exceptions/http-exception";
import {
  actorFromId,
  trackDealCreatedServer,
  trackDealLost,
  trackDealStageChangedServer,
  trackDealWon,
} from "@/lib/events";
import { dealRepository } from "@/modules/deals/deals.repository";
import type {
  CreateDealInput,
  ListDealsQuery,
  UpdateDealInput,
} from "@/modules/deals/deals.validation";

/**
 * Mirrors the leads/opportunities/accounts pattern (PRD §7): default
 * `deals:read` is "own records only"; `crm:team-read` widens to all
 * deals in the workspace. Threaded through every list / detail /
 * mutation method so a rep without `crm:team-read` can't list, fetch,
 * update, or delete another rep's deal. (#519.)
 */
export class DealService {
  async list(userId: string, permissions: string[], query: ListDealsQuery) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await dealRepository.findMany(
      { ...filters, ownerScope },
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, permissions: string[]) {
    const deal = await dealRepository.findById(id);
    if (!deal) throw new NotFoundException("Deal not found");

    const canSeeAll = permissions.includes("crm:team-read");
    // 404 (not 403) when the actor lacks scope — mirrors the leads
    // pattern, which avoids leaking row existence to non-owners.
    if (!canSeeAll && deal.ownerId !== userId) {
      throw new NotFoundException("Deal not found");
    }
    return deal;
  }

  async create(ownerId: string, input: CreateDealInput) {
    const created = await dealRepository.create({
      company: input.company,
      contact: input.contact,
      value: input.value,
      stage: input.stage ?? "lead",
      probability: input.probability ?? 10,
      type: input.type,
      country: input.country,
      closeDate: input.closeDate ? new Date(input.closeDate) : undefined,
      notes: input.notes,
      owner: { connect: { id: ownerId } },
      partner: input.partnerId
        ? { connect: { id: input.partnerId } }
        : undefined,
    });

    try {
      const trackingActor = await actorFromId(ownerId);
      if (trackingActor) {
        trackDealCreatedServer(trackingActor, {
          amount_thb: input.value ?? undefined,
          stage: input.stage ?? "lead",
        });
      }
    } catch {
      // analytics is best-effort
    }

    return created;
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateDealInput,
  ) {
    // `getById` enforces the scoping rule — if the caller can't see
    // the row they get a 404 here before any write touches Prisma.
    const previous = await this.getById(id, userId, permissions);

    const updated = await dealRepository.update(id, {
      ...(input.company !== undefined && { company: input.company }),
      ...(input.contact !== undefined && { contact: input.contact || null }),
      ...(input.value !== undefined && { value: input.value }),
      ...(input.stage !== undefined && { stage: input.stage }),
      ...(input.probability !== undefined && {
        probability: input.probability,
      }),
      ...(input.type !== undefined && { type: input.type || null }),
      ...(input.country !== undefined && { country: input.country || null }),
      ...(input.closeDate !== undefined && {
        closeDate: input.closeDate ? new Date(input.closeDate) : null,
      }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
      ...(input.partnerId !== undefined && {
        partner: input.partnerId
          ? { connect: { id: input.partnerId } }
          : { disconnect: true },
      }),
    });

    if (input.stage !== undefined && input.stage !== previous.stage) {
      try {
        const trackingActor = await actorFromId(userId);
        if (trackingActor) {
          trackDealStageChangedServer(trackingActor, {
            deal_id: id,
            from_stage: previous.stage,
            to_stage: input.stage,
          });
          if (input.stage === "closed_won") {
            trackDealWon(trackingActor, {
              deal_id: id,
              amount_thb:
                input.value !== undefined
                  ? input.value
                  : previous.value
                    ? Number(previous.value)
                    : undefined,
            });
          } else if (input.stage === "closed_lost") {
            trackDealLost(trackingActor, { deal_id: id });
          }
        }
      } catch {
        // analytics is best-effort
      }
    }

    return updated;
  }

  async delete(id: string, userId: string, permissions: string[]) {
    // `getById` enforces the scoping rule — non-owner without
    // `crm:team-read` gets a 404 before the delete hits Prisma.
    await this.getById(id, userId, permissions);
    return dealRepository.delete(id);
  }

  // Pipeline totals respect the same scoping — a rep without
  // `crm:team-read` sees their own pipeline only, otherwise the
  // workspace-wide rollup.
  async getPipelineSummary(userId: string, permissions: string[]) {
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];
    return dealRepository.pipelineSummary(ownerScope);
  }
}

export const dealService = new DealService();
