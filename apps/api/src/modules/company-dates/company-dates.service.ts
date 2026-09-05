import type { Prisma } from "@nexora/database";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { companyDatesRepository } from "@/modules/company-dates/company-dates.repository";
import type {
  CreateCompanyDateInput,
  UpdateCompanyDateInput,
} from "@/modules/company-dates/company-dates.validation";

export const companyDatesService = {
  async listUpcoming(page: number, limit: number) {
    const { data, total } = await companyDatesRepository.findUpcoming(
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getById(id: string) {
    const date = await companyDatesRepository.findById(id);
    if (!date) throw new NotFoundException("Company date not found");
    return date;
  },

  async create(addedBy: string, input: CreateCompanyDateInput) {
    return companyDatesRepository.create({
      title: input.title,
      date: new Date(input.date),
      type: input.type,
      location: input.location,
      addedBy,
      attachments:
        input.attachments && input.attachments.length > 0
          ? (input.attachments as unknown as Prisma.InputJsonValue)
          : undefined,
    });
  },

  async update(id: string, input: UpdateCompanyDateInput) {
    const existing = await companyDatesRepository.findById(id);
    if (!existing) throw new NotFoundException("Company date not found");

    return companyDatesRepository.update(id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.date !== undefined && { date: new Date(input.date) }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.location !== undefined && { location: input.location }),
    });
  },

  async delete(id: string) {
    const date = await companyDatesRepository.findById(id);
    if (!date) throw new NotFoundException("Company date not found");
    return companyDatesRepository.delete(id);
  },
};
