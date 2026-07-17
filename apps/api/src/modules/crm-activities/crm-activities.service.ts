import { NotFoundException } from "@/common/exceptions/http-exception";
import { crmActivityRepository } from "@/modules/crm-activities/crm-activities.repository";
import type {
  CreateCrmActivityInput,
  ListCrmActivitiesQuery,
  UpdateCrmActivityInput,
} from "@/modules/crm-activities/crm-activities.validation";

export class CrmActivityService {
  async list(
    userId: string,
    permissions: string[],
    query: ListCrmActivitiesQuery,
  ) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await crmActivityRepository.findMany(
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
    const activity = await crmActivityRepository.findById(id);
    if (!activity) throw new NotFoundException("Activity not found");

    const canSeeAll = permissions.includes("crm:team-read");
    if (!canSeeAll && activity.ownerId !== userId) {
      throw new NotFoundException("Activity not found");
    }
    return activity;
  }

  async create(ownerId: string, input: CreateCrmActivityInput) {
    return crmActivityRepository.create({
      type: input.type,
      subject: input.subject,
      body: input.body,
      occurredAt: new Date(input.occurredAt),
      durationMins: input.durationMins,
      owner: { connect: { id: ownerId } },
      ...(input.leadId && { lead: { connect: { id: input.leadId } } }),
      ...(input.opportunityId && {
        opportunity: { connect: { id: input.opportunityId } },
      }),
      ...(input.contactId && {
        contact: { connect: { id: input.contactId } },
      }),
      ...(input.accountId && {
        account: { connect: { id: input.accountId } },
      }),
    });
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateCrmActivityInput,
  ) {
    await this.getById(id, userId, permissions);

    return crmActivityRepository.update(id, {
      ...(input.type !== undefined && { type: input.type }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.body !== undefined && { body: input.body || null }),
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
    return crmActivityRepository.delete(id);
  }
}

export const crmActivityService = new CrmActivityService();
