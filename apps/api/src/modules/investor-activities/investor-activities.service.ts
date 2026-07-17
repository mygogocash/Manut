import { PERMISSIONS } from "@/common/constants/permissions";
import { NotFoundException } from "@/common/exceptions/http-exception";
import { investorActivityRepository } from "@/modules/investor-activities/investor-activities.repository";
import type {
  CreateInvestorActivityInput,
  ListInvestorActivitiesQuery,
  UpdateInvestorActivityInput,
} from "@/modules/investor-activities/investor-activities.validation";
import { investorsRepository } from "@/modules/investors/investors.repository";

export class InvestorActivityService {
  async list(
    userId: string,
    permissions: string[],
    query: ListInvestorActivitiesQuery,
  ) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    const ownerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await investorActivityRepository.findMany(
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
    const activity = await investorActivityRepository.findById(id);
    if (!activity) throw new NotFoundException("Activity not found");

    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    if (!canSeeAll && activity.ownerId !== userId) {
      throw new NotFoundException("Activity not found");
    }
    return activity;
  }

  // Block anchoring an activity to an investor the caller can't see (IDOR).
  private async assertInvestorAccess(
    investorId: string,
    userId: string,
    permissions: string[],
  ) {
    const investor = await investorsRepository.findById(investorId);
    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    if (!investor || (!canSeeAll && investor.addedBy !== userId)) {
      throw new NotFoundException("Investor not found");
    }
  }

  async create(
    ownerId: string,
    permissions: string[],
    input: CreateInvestorActivityInput,
  ) {
    await this.assertInvestorAccess(input.investorId, ownerId, permissions);
    return investorActivityRepository.create({
      type: input.type,
      subject: input.subject,
      body: input.body ?? null,
      occurredAt: new Date(input.occurredAt),
      durationMins: input.durationMins ?? null,
      owner: { connect: { id: ownerId } },
      investor: { connect: { id: input.investorId } },
    });
  }

  // The investor anchor is immutable; only the activity's own fields edit.
  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateInvestorActivityInput,
  ) {
    await this.getById(id, userId, permissions);

    return investorActivityRepository.update(id, {
      ...(input.type !== undefined && { type: input.type }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.occurredAt !== undefined && {
        occurredAt: new Date(input.occurredAt),
      }),
      ...(input.durationMins !== undefined && {
        durationMins: input.durationMins,
      }),
    });
  }

  async delete(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return investorActivityRepository.delete(id);
  }
}

export const investorActivityService = new InvestorActivityService();
