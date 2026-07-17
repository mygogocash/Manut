import { PERMISSIONS } from "@/common/constants/permissions";
import { NotFoundException } from "@/common/exceptions/http-exception";
import { investorAccountRepository } from "@/modules/investor-accounts/investor-accounts.repository";
import { investorContactRepository } from "@/modules/investor-contacts/investor-contacts.repository";
import type {
  CreateInvestorContactInput,
  ListInvestorContactsQuery,
  UpdateInvestorContactInput,
} from "@/modules/investor-contacts/investor-contacts.validation";

export class InvestorContactService {
  async list(
    userId: string,
    permissions: string[],
    query: ListInvestorContactsQuery,
  ) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    const ownerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await investorContactRepository.findMany(
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
    const contact = await investorContactRepository.findById(id);
    if (!contact) throw new NotFoundException("Contact not found");

    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    if (!canSeeAll && contact.ownerId !== userId) {
      throw new NotFoundException("Contact not found");
    }
    return contact;
  }

  // Block linking to an account the caller can't see — without this a
  // crafted accountId would attach the contact to another owner's account
  // and leak its name back in the include (IDOR).
  private async assertAccountAccess(
    accountId: string,
    userId: string,
    permissions: string[],
  ) {
    const account = await investorAccountRepository.findById(accountId);
    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    if (!account || (!canSeeAll && account.ownerId !== userId)) {
      throw new NotFoundException("Account not found");
    }
  }

  async create(
    ownerId: string,
    permissions: string[],
    input: CreateInvestorContactInput,
  ) {
    if (input.accountId) {
      await this.assertAccountAccess(input.accountId, ownerId, permissions);
    }
    return investorContactRepository.create({
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      title: input.title ?? null,
      owner: { connect: { id: ownerId } },
      ...(input.accountId
        ? { account: { connect: { id: input.accountId } } }
        : {}),
    });
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateInvestorContactInput,
  ) {
    await this.getById(id, userId, permissions);
    if (typeof input.accountId === "string" && input.accountId) {
      await this.assertAccountAccess(input.accountId, userId, permissions);
    }
    return investorContactRepository.update(id, {
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.accountId !== undefined && {
        account: input.accountId
          ? { connect: { id: input.accountId } }
          : { disconnect: true },
      }),
    });
  }

  async delete(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return investorContactRepository.delete(id);
  }
}

export const investorContactService = new InvestorContactService();
