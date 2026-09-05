import type {
  CreateContactInput,
  CreatePartnerInput,
  ImportPartnerTaskRow,
  PartnerQuery,
  UpdateContactInput,
  UpdatePartnerInput,
} from "@nexora/contracts/modules/partners/partners.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import { buildPartnerSlug } from "./partner-slug";
import * as repo from "./partners.repository";

function optionalDate(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return v;
}

function partnerInsertFromCreate(input: CreatePartnerInput) {
  return {
    company: input.company,
    type: input.type,
    status: input.status,
    region: input.region ?? null,
    country: input.country ?? null,
    website: input.website || null,
    description: input.description ?? null,
    contractValue: input.contractValue != null ? String(input.contractValue) : null,
    contractStart: optionalDate(input.contractStart) ?? null,
    contractEnd: optionalDate(input.contractEnd) ?? null,
    notes: input.notes ?? null,
    productionLiveDate: optionalDate(input.productionLiveDate) ?? null,
    goLiveDate: optionalDate(input.goLiveDate) ?? null,
    revisedGoLiveDate: optionalDate(input.revisedGoLiveDate) ?? null,
    pastCampaignDate: optionalDate(input.pastCampaignDate) ?? null,
    nextCampaignDate: optionalDate(input.nextCampaignDate) ?? null,
    dependency: input.dependency ?? null,
    comment: input.comment ?? null,
    department: input.department ?? null,
    ownerId: input.ownerId ?? null,
    contacts: input.contacts?.map((c) => ({
      name: c.name,
      title: c.title,
      email: c.email,
      phone: c.phone,
      isPrimary: c.isPrimary,
    })),
  };
}

export async function list(db: Db, query: PartnerQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, filters, page, limit);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getById(db: Db, idOrSlug: string) {
  const partner = await repo.findByIdOrSlug(db, idOrSlug);
  if (!partner) throw new NotFoundException("Partner not found");
  return partner;
}

export async function importRows(db: Db, rows: CreatePartnerInput[], _actorId?: string) {
  let created = 0;
  for (const row of rows) {
    await create(db, row, _actorId);
    created++;
  }
  return { created };
}

export async function exportTasks(db: Db, query: PartnerQuery) {
  const { data: partners } = await list(db, { ...query, page: 1, limit: 1000 });
  const tasks = await repo.findTasksByPartnerIds(
    db,
    partners.map((p) => p.id),
  );
  return tasks.map((t) => ({
    partner: t.partner?.company ?? "",
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    priority: t.priority,
    owner: t.owner?.name ?? "",
    startDate: t.startDate ?? "",
    endDate: t.endDate ?? "",
    parentTitle: t.parent?.title ?? "",
  }));
}

export async function importTasks(db: Db, rows: ImportPartnerTaskRow[]) {
  const { data: partners } = await list(db, { page: 1, limit: 1000 });
  const byName = new Map(partners.map((p) => [p.company.trim().toLowerCase(), p]));

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
      const task = await repo.createTaskRaw(db, {
        partnerId: partner.id,
        parentTaskId: parentId,
        title: row.title,
        description: row.description,
        status: row.status ?? "todo",
        priority: row.priority ?? "medium",
        startDate: row.startDate ?? null,
        endDate: row.endDate ?? null,
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

export async function create(db: Db, input: CreatePartnerInput, _actorId?: string) {
  return repo.create(db, partnerInsertFromCreate(input));
}

export async function update(db: Db, idOrSlug: string, input: UpdatePartnerInput, _actorId?: string) {
  const previous = await getById(db, idOrSlug);
  const id = previous.id;

  const patch: Parameters<typeof repo.update>[2] = {};

  if (input.company !== undefined) {
    patch.company = input.company;
    patch.slug = buildPartnerSlug(input.company, id);
  }
  if (input.type !== undefined) patch.type = input.type;
  if (input.status !== undefined) patch.status = input.status;
  if (input.region !== undefined) patch.region = input.region;
  if (input.country !== undefined) patch.country = input.country;
  if (input.website !== undefined) patch.website = input.website || null;
  if (input.description !== undefined) patch.description = input.description;
  if (input.contractValue !== undefined) {
    patch.contractValue = input.contractValue != null ? String(input.contractValue) : null;
  }
  if (input.contractStart !== undefined) patch.contractStart = optionalDate(input.contractStart) ?? null;
  if (input.contractEnd !== undefined) patch.contractEnd = optionalDate(input.contractEnd) ?? null;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.productionLiveDate !== undefined) {
    patch.productionLiveDate = optionalDate(input.productionLiveDate) ?? null;
  }
  if (input.goLiveDate !== undefined) patch.goLiveDate = optionalDate(input.goLiveDate) ?? null;
  if (input.revisedGoLiveDate !== undefined) {
    patch.revisedGoLiveDate = optionalDate(input.revisedGoLiveDate) ?? null;
  }
  if (input.pastCampaignDate !== undefined) {
    patch.pastCampaignDate = optionalDate(input.pastCampaignDate) ?? null;
  }
  if (input.nextCampaignDate !== undefined) {
    patch.nextCampaignDate = optionalDate(input.nextCampaignDate) ?? null;
  }
  if (input.dependency !== undefined) patch.dependency = input.dependency;
  if (input.comment !== undefined) patch.comment = input.comment;
  if (input.department !== undefined) patch.department = input.department;
  if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
  if (input.contacts !== undefined) {
    patch.contacts = input.contacts.map((c) => ({
      name: c.name ?? "",
      title: c.title,
      email: c.email,
      phone: c.phone,
      isPrimary: c.isPrimary ?? false,
    }));
  }

  return repo.update(db, id, patch);
}

export async function remove(db: Db, id: string) {
  await getById(db, id);
  await repo.remove(db, id);
}

export async function reorder(db: Db, ids: string[]) {
  return { data: await repo.reorder(db, ids) };
}

export async function listContacts(db: Db, partnerId: string) {
  await getById(db, partnerId);
  return repo.findContacts(db, partnerId);
}

export async function createContact(db: Db, partnerId: string, input: CreateContactInput) {
  await getById(db, partnerId);
  return repo.createContact(db, partnerId, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: input.role,
    isPrimary: input.isPrimary,
  });
}

export async function updateContact(
  db: Db,
  partnerId: string,
  contactId: string,
  input: UpdateContactInput,
) {
  await getById(db, partnerId);
  const contact = await repo.findContactById(db, contactId);
  if (!contact || contact.partnerId !== partnerId) {
    throw new NotFoundException("Contact not found");
  }
  return repo.updateContact(db, contactId, input);
}

export async function deleteContact(db: Db, partnerId: string, contactId: string) {
  await getById(db, partnerId);
  const contact = await repo.findContactById(db, contactId);
  if (!contact || contact.partnerId !== partnerId) {
    throw new NotFoundException("Contact not found");
  }
  await repo.deleteContact(db, contactId);
}
