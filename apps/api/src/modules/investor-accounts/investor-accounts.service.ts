import { PERMISSIONS } from "@/common/constants/permissions";
import { NotFoundException } from "@/common/exceptions/http-exception";
import { resolveFundraisingEntityKey } from "@/modules/fundraising-entities/fundraising-entities.service";
import { investorAccountRepository } from "@/modules/investor-accounts/investor-accounts.repository";
import type {
  CreateInvestorAccountInput,
  ListInvestorAccountsQuery,
  UpdateInvestorAccountInput,
} from "@/modules/investor-accounts/investor-accounts.validation";

export class InvestorAccountService {
  async list(
    userId: string,
    permissions: string[],
    query: ListInvestorAccountsQuery,
  ) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    const ownerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await investorAccountRepository.findMany(
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
    const account = await investorAccountRepository.findById(id);
    if (!account) throw new NotFoundException("Account not found");

    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    if (!canSeeAll && account.ownerId !== userId) {
      throw new NotFoundException("Account not found");
    }
    return account;
  }

  async create(ownerId: string, input: CreateInvestorAccountInput) {
    const fundraisingEntity = await resolveFundraisingEntityKey(
      input.fundraisingEntity,
    );
    return investorAccountRepository.create({
      name: input.name,
      type: input.type ?? null,
      website: input.website ?? null,
      location: input.location ?? null,
      region: input.region ?? null,
      notes: input.notes ?? null,
      fundraisingEntity,
      owner: { connect: { id: ownerId } },
    });
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateInvestorAccountInput,
  ) {
    await this.getById(id, userId, permissions);
    return investorAccountRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.website !== undefined && { website: input.website }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.region !== undefined && { region: input.region }),
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
    return investorAccountRepository.delete(id);
  }

  // Reversible archive — orthogonal to the record's other fields. Reuses the
  // owner-or-read-all guard in getById; preserves an existing archivedAt so a
  // re-archive doesn't reset the timestamp.
  async archive(id: string, userId: string, permissions: string[]) {
    const existing = await this.getById(id, userId, permissions);
    return investorAccountRepository.update(id, {
      archivedAt: existing.archivedAt ?? new Date(),
    });
  }

  async unarchive(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return investorAccountRepository.update(id, { archivedAt: null });
  }
}

export const investorAccountService = new InvestorAccountService();
