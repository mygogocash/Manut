import { PERMISSIONS } from "@/common/constants/permissions";
import { NotFoundException } from "@/common/exceptions/http-exception";
import { resolveFundraisingEntityKey } from "@/modules/fundraising-entities/fundraising-entities.service";
import { investorLeadRepository } from "@/modules/investor-leads/investor-leads.repository";
import type {
  CreateInvestorLeadInput,
  ListInvestorLeadsQuery,
  UpdateInvestorLeadInput,
} from "@/modules/investor-leads/investor-leads.validation";

export class InvestorLeadService {
  async list(
    userId: string,
    permissions: string[],
    query: ListInvestorLeadsQuery,
  ) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    const ownerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await investorLeadRepository.findMany(
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
    const lead = await investorLeadRepository.findById(id);
    if (!lead) throw new NotFoundException("Lead not found");

    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    if (!canSeeAll && lead.ownerId !== userId) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }

  async create(ownerId: string, input: CreateInvestorLeadInput) {
    const fundraisingEntity = await resolveFundraisingEntityKey(
      input.fundraisingEntity,
    );
    return investorLeadRepository.create({
      name: input.name,
      company: input.company ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      source: input.source ?? null,
      status: input.status,
      notes: input.notes ?? null,
      fundraisingEntity,
      owner: { connect: { id: ownerId } },
    });
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateInvestorLeadInput,
  ) {
    await this.getById(id, userId, permissions);
    return investorLeadRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.company !== undefined && { company: input.company }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.source !== undefined && { source: input.source }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.fundraisingEntity !== undefined && {
        fundraisingEntity: await resolveFundraisingEntityKey(
          input.fundraisingEntity,
        ),
      }),
    });
  }

  async delete(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return investorLeadRepository.delete(id);
  }

  // Reversible archive. No status guard — a lead may be archived in any
  // status (new / qualified / converted / disqualified). Idempotent:
  // re-archiving keeps the original archivedAt stamp.
  async archive(id: string, userId: string, permissions: string[]) {
    const existing = await this.getById(id, userId, permissions);
    return investorLeadRepository.update(id, {
      archivedAt: existing.archivedAt ?? new Date(),
    });
  }

  async unarchive(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return investorLeadRepository.update(id, { archivedAt: null });
  }
}

export const investorLeadService = new InvestorLeadService();
