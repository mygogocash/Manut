import { NotFoundException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { accountRepository } from "@/modules/revenue-accounts/accounts.repository";
import { contactRepository } from "@/modules/revenue-contacts/contacts.repository";
import type {
  CreateContactInput,
  ListContactsQuery,
  UpdateContactInput,
} from "@/modules/revenue-contacts/contacts.validation";

export class ContactService {
  // Scope by parent Account.ownerId rather than a Contact-level field
  // (Contact has no owner). Reps see contacts on accounts they own.
  async list(userId: string, permissions: string[], query: ListContactsQuery) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes("sales-revenue:team-read");
    const accountOwnerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await contactRepository.findMany(
      { ...filters, accountOwnerScope },
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, permissions: string[]) {
    const contact = await contactRepository.findById(id);
    if (!contact) throw new NotFoundException("Contact not found");

    const canSeeAll = permissions.includes("sales-revenue:team-read");
    if (!canSeeAll && contact.account.ownerId !== userId) {
      throw new NotFoundException("Contact not found");
    }
    return contact;
  }

  async create(
    userId: string,
    permissions: string[],
    input: CreateContactInput,
  ) {
    // Confirm the parent account exists and the rep can see it. Reuse the
    // Account guard so a non-team-read user cannot stash a contact under
    // someone else's account.
    const canSeeAll = permissions.includes("sales-revenue:team-read");
    const account = await accountRepository.findById(input.accountId);
    if (!account || (!canSeeAll && account.ownerId !== userId)) {
      throw new NotFoundException("Account not found");
    }

    // First contact on an account is auto-primary; otherwise honour the input
    // flag (default false). When isPrimary flips true we have to demote the
    // sibling that currently holds it — do that in a transaction.
    const existingCount = await contactRepository.countForAccount(
      input.accountId,
    );
    const promote = input.isPrimary === true || existingCount === 0;

    if (promote) {
      return prisma.$transaction(async (tx) => {
        const created = await tx.revenueContact.create({
          data: {
            account: { connect: { id: input.accountId } },
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            title: input.title,
            notes: input.notes,
            isPrimary: true,
          },
          include: {
            account: { select: { id: true, name: true, ownerId: true } },
          },
        });
        await contactRepository.clearPrimaryForAccount(
          tx,
          input.accountId,
          created.id,
        );
        return created;
      });
    }

    return contactRepository.create({
      account: { connect: { id: input.accountId } },
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      title: input.title,
      notes: input.notes,
      isPrimary: false,
    });
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateContactInput,
  ) {
    const existing = await this.getById(id, userId, permissions);

    const promoting = input.isPrimary === true && !existing.isPrimary;

    const updateData: Parameters<typeof contactRepository.update>[1] = {
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
      ...(input.email !== undefined && { email: input.email || null }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.title !== undefined && { title: input.title || null }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
      ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
    };

    if (promoting) {
      return prisma.$transaction(async (tx) => {
        const updated = await tx.revenueContact.update({
          where: { id },
          data: updateData,
          include: {
            account: { select: { id: true, name: true, ownerId: true } },
          },
        });
        await contactRepository.clearPrimaryForAccount(
          tx,
          existing.account.id,
          id,
        );
        return updated;
      });
    }

    return contactRepository.update(id, updateData);
  }

  async delete(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return contactRepository.delete(id);
  }
}

export const contactService = new ContactService();
