import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { investorUpdateRepository } from "@/modules/investor-updates/investor-updates.repository";
import type {
  CreateUpdateInput,
  ListUpdatesQuery,
  UpdateUpdateInput,
} from "@/modules/investor-updates/investor-updates.validation";

export class InvestorUpdateService {
  async list(query: ListUpdatesQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await investorUpdateRepository.findMany(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const update = await investorUpdateRepository.findById(id);
    if (!update) throw new NotFoundException("Investor update not found");
    return update;
  }

  async create(input: CreateUpdateInput) {
    return investorUpdateRepository.create({
      title: input.title,
      content: input.content,
      period: input.period,
      status: input.status ?? "draft",
    });
  }

  async update(id: string, input: UpdateUpdateInput) {
    const existing = await this.getById(id);
    if (existing.status === "sent") {
      throw new BadRequestException("Cannot edit a sent update");
    }

    return investorUpdateRepository.update(id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.period !== undefined && { period: input.period }),
      ...(input.status !== undefined && { status: input.status }),
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return investorUpdateRepository.delete(id);
  }

  async send(id: string, sentBy: string) {
    const existing = await this.getById(id);
    if (existing.status === "sent") {
      throw new BadRequestException("Update has already been sent");
    }

    return investorUpdateRepository.markAsSent(id, sentBy);
  }
}

export const investorUpdateService = new InvestorUpdateService();
