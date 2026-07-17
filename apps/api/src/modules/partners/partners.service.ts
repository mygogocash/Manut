import { NotFoundException } from "@/common/exceptions/http-exception";
import {
  actorFromId,
  trackPartnerCreatedServer,
  trackPartnerNoteAddedServer,
} from "@/lib/events";
import { buildPartnerSlug } from "@/modules/partners/partner-slug";
import { partnerRepository } from "@/modules/partners/partners.repository";
import type {
  CreateContactInput,
  CreatePartnerInput,
  ImportPartnerTaskRow,
  PartnerQuery,
  UpdateContactInput,
  UpdatePartnerInput,
} from "@/modules/partners/partners.validation";

export class PartnerService {
  async list(query: PartnerQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await partnerRepository.findMany(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(idOrSlug: string) {
    const partner = await partnerRepository.findByIdOrSlug(idOrSlug);
    if (!partner) throw new NotFoundException("Partner not found");
    return partner;
  }

  async importRows(rows: CreatePartnerInput[], actorId?: string) {
    // Create-new-only; reuse `create` per row so each partner gets a
    // default board / workspace exactly like a hand-created one.
    let created = 0;
    for (const row of rows) {
      await this.create(row, actorId);
      created++;
    }
    return { created };
  }

  // ─── Task export / import ─────────────────────────────

  // Flat task dump for the Tasks export — scopes to the filtered
  // partners, then fetches all their tasks (incl. subtasks) in one
  // query and flattens to export rows.
  async exportTasks(query: PartnerQuery) {
    const { data: partners } = await this.list({
      ...query,
      page: 1,
      limit: 1000,
    });
    const tasks = await partnerRepository.findTasksByPartnerIds(
      partners.map((p) => p.id),
    );
    return tasks.map((t) => ({
      partner: t.partner?.company ?? "",
      title: t.title,
      description: t.description ?? "",
      status: t.status,
      priority: t.priority,
      owner: t.owner?.name ?? "",
      startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : "",
      endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : "",
      parentTitle: t.parent?.title ?? "",
    }));
  }

  // Bulk partner-task import. Rows reference their partner by company
  // name (matched case-insensitively). Two passes per partner: create
  // top-level tasks first so a subtask in the same batch resolves its
  // parent; an orphan subtask lands as top-level rather than dropping.
  async importTasks(rows: ImportPartnerTaskRow[]) {
    const { data: partners } = await this.list({ page: 1, limit: 1000 });
    const byName = new Map(
      partners.map((p) => [p.company.trim().toLowerCase(), p]),
    );

    const groups = new Map<string, ImportPartnerTaskRow[]>();
    for (const row of rows) {
      const key = row.partner.trim().toLowerCase();
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }

    let created = 0;
    let skipped = 0;
    for (const [key, group] of groups) {
      const partner = byName.get(key);
      if (!partner) {
        skipped += group.length;
        continue;
      }
      const titleToId = new Map<string, string>();
      const makeTask = async (row: ImportPartnerTaskRow, parentId?: string) => {
        const task = await partnerRepository.createTaskRaw({
          partnerId: partner.id,
          parentTaskId: parentId,
          title: row.title,
          description: row.description,
          status: row.status ?? "todo",
          priority: row.priority ?? "medium",
          startDate: row.startDate ? new Date(row.startDate) : undefined,
          endDate: row.endDate ? new Date(row.endDate) : undefined,
          sortOrder: 0,
        });
        titleToId.set(row.title.trim().toLowerCase(), task.id);
        created++;
      };
      for (const row of group.filter((r) => !r.parentTitle)) {
        await makeTask(row);
      }
      for (const row of group.filter((r) => r.parentTitle)) {
        const parentId = titleToId.get(row.parentTitle!.trim().toLowerCase());
        await makeTask(row, parentId);
      }
    }
    return { created, skipped };
  }

  async create(input: CreatePartnerInput, actorId?: string) {
    const contacts = input.contacts?.map((c) => ({
      name: c.name,
      title: c.title,
      email: c.email,
      phone: c.phone,
      isPrimary: c.isPrimary,
    }));

    const created = await partnerRepository.create({
      company: input.company,
      type: input.type,
      status: input.status,
      region: input.region,
      country: input.country,
      website: input.website || undefined,
      description: input.description,
      contractValue: input.contractValue,
      contractStart: input.contractStart
        ? new Date(input.contractStart)
        : undefined,
      contractEnd: input.contractEnd ? new Date(input.contractEnd) : undefined,
      notes: input.notes,
      productionLiveDate: input.productionLiveDate
        ? new Date(input.productionLiveDate)
        : undefined,
      goLiveDate: input.goLiveDate ? new Date(input.goLiveDate) : undefined,
      revisedGoLiveDate: input.revisedGoLiveDate
        ? new Date(input.revisedGoLiveDate)
        : undefined,
      pastCampaignDate: input.pastCampaignDate
        ? new Date(input.pastCampaignDate)
        : undefined,
      nextCampaignDate: input.nextCampaignDate
        ? new Date(input.nextCampaignDate)
        : undefined,
      dependency: input.dependency ?? undefined,
      comment: input.comment ?? undefined,
      department: input.department ?? undefined,
      owner: input.ownerId ? { connect: { id: input.ownerId } } : undefined,
      contacts,
    });

    // Phase 4a of the Partner ↔ Project decouple (Marketing
    // incident, 2026-05-26): Partner CRM now owns its native
    // workspace via `partner_*` tables (Phase 1 = #603, Phase 2 =
    // #605, Phase 3 = #606). Auto-creating a backing Project is no
    // longer necessary — new Partners use the native board
    // directly. The legacy `primaryProjectId` column stays in DB
    // for backward compat until Phase 4b drops it.

    try {
      const trackingActor = await actorFromId(actorId);
      if (trackingActor) {
        trackPartnerCreatedServer(trackingActor);
      }
    } catch {
      // analytics is best-effort
    }

    return created;
  }

  async update(idOrSlug: string, input: UpdatePartnerInput, actorId?: string) {
    const previous = await this.getById(idOrSlug);
    const id = previous.id;

    const contacts = input.contacts?.map((c) => ({
      name: c.name ?? "",
      title: c.title,
      email: c.email,
      phone: c.phone,
      isPrimary: c.isPrimary ?? false,
    }));

    const updated = await partnerRepository.update(id, {
      ...(input.company !== undefined && {
        company: input.company,
        slug: buildPartnerSlug(input.company, id),
      }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.region !== undefined && { region: input.region }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.website !== undefined && { website: input.website || null }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.contractValue !== undefined && {
        contractValue: input.contractValue,
      }),
      ...(input.contractStart !== undefined && {
        contractStart: input.contractStart
          ? new Date(input.contractStart)
          : null,
      }),
      ...(input.contractEnd !== undefined && {
        contractEnd: input.contractEnd ? new Date(input.contractEnd) : null,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.productionLiveDate !== undefined && {
        productionLiveDate: input.productionLiveDate
          ? new Date(input.productionLiveDate)
          : null,
      }),
      ...(input.goLiveDate !== undefined && {
        goLiveDate: input.goLiveDate ? new Date(input.goLiveDate) : null,
      }),
      ...(input.revisedGoLiveDate !== undefined && {
        revisedGoLiveDate: input.revisedGoLiveDate
          ? new Date(input.revisedGoLiveDate)
          : null,
      }),
      ...(input.pastCampaignDate !== undefined && {
        pastCampaignDate: input.pastCampaignDate
          ? new Date(input.pastCampaignDate)
          : null,
      }),
      ...(input.nextCampaignDate !== undefined && {
        nextCampaignDate: input.nextCampaignDate
          ? new Date(input.nextCampaignDate)
          : null,
      }),
      ...(input.dependency !== undefined && { dependency: input.dependency }),
      ...(input.comment !== undefined && { comment: input.comment }),
      ...(input.department !== undefined && { department: input.department }),
      ...(input.ownerId !== undefined && {
        // Use relation syntax so null + undefined are both handled
        // (null disconnects, undefined skips). Prisma's
        // `PartnerUpdateInput.owner` accepts `{disconnect:true}` for
        // null and `{connect:{id}}` for set.
        owner: input.ownerId
          ? { connect: { id: input.ownerId } }
          : { disconnect: true },
      }),
      ...(input.contacts !== undefined && { contacts }),
    });

    // The Partner schema has a single `notes` text column rather than a
    // timeline. Emit `partner.note_added` whenever the column is touched
    // and the value actually changed — close enough to "the user added a
    // note" for adoption analytics.
    if (input.notes !== undefined && input.notes !== previous.notes) {
      try {
        const trackingActor = await actorFromId(actorId);
        if (trackingActor) {
          trackPartnerNoteAddedServer(trackingActor, { partner_id: id });
        }
      } catch {
        // analytics is best-effort
      }
    }

    return updated;
  }

  async delete(id: string) {
    await this.getById(id);
    return partnerRepository.delete(id);
  }

  /**
   * Persist a new manual order from the drag-to-reorder UI. Mirrors
   * the Projects reorder semantics — unknown ids are silently dropped
   * so a stale client list can't corrupt the server-side ordering.
   */
  async reorder(ids: string[]) {
    return { data: await partnerRepository.reorder(ids) };
  }

  async listContacts(partnerId: string) {
    await this.getById(partnerId);
    return partnerRepository.findContacts(partnerId);
  }

  async createContact(partnerId: string, input: CreateContactInput) {
    await this.getById(partnerId);
    return partnerRepository.createContact(partnerId, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      isPrimary: input.isPrimary,
    });
  }

  async updateContact(
    partnerId: string,
    contactId: string,
    input: UpdateContactInput,
  ) {
    await this.getById(partnerId);
    const contact = await partnerRepository.findContactById(contactId);
    if (!contact || contact.partnerId !== partnerId) {
      throw new NotFoundException("Contact not found");
    }
    return partnerRepository.updateContact(contactId, input);
  }

  async deleteContact(partnerId: string, contactId: string) {
    await this.getById(partnerId);
    const contact = await partnerRepository.findContactById(contactId);
    if (!contact || contact.partnerId !== partnerId) {
      throw new NotFoundException("Contact not found");
    }
    return partnerRepository.deleteContact(contactId);
  }
}

export const partnerService = new PartnerService();
