import type { Db } from "@nexora/db";
import type {
  CreateCompanyDateInput,
  UpdateCompanyDateInput,
} from "@nexora/contracts/modules/company-dates/company-dates.validation";
import { NotFoundException } from "../http-exception";
import * as repo from "./company-dates.repository";

export async function listUpcoming(db: Db, page: number, limit: number) {
  const { data, total } = await repo.findUpcoming(db, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string) {
  const date = await repo.findById(db, id);
  if (!date) throw new NotFoundException("Company date not found");
  return date;
}

export async function create(db: Db, addedBy: string, input: CreateCompanyDateInput) {
  return repo.create(db, {
    title: input.title,
    date: input.date,
    type: input.type,
    location: input.location,
    addedBy,
    attachments: input.attachments && input.attachments.length > 0 ? input.attachments : undefined,
  });
}

export async function update(db: Db, id: string, input: UpdateCompanyDateInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Company date not found");
  return repo.update(db, id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.date !== undefined && { date: input.date }),
    ...(input.type !== undefined && { type: input.type }),
    ...(input.location !== undefined && { location: input.location }),
  });
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Company date not found");
  await repo.remove(db, id);
}
