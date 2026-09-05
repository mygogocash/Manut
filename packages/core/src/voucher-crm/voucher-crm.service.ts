import type {
  CreateVoucherEntryInput,
  ImportVoucherEntriesInput,
  ReorderVoucherEntriesInput,
  UpdateVoucherEntryInput,
  VoucherQuery,
} from "@nexora/contracts/modules/voucher-crm/voucher-crm.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import * as repo from "./voucher-crm.repository";

export async function list(db: Db, query: VoucherQuery) {
  const { rows, total, totals } = await repo.listEntries(db, query);
  return {
    data: rows,
    totals,
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) || 1 },
  };
}

export async function getById(db: Db, id: string) {
  const row = await repo.getEntry(db, id);
  if (!row) throw new NotFoundException("Voucher entry not found");
  return row;
}

export async function create(db: Db, input: CreateVoucherEntryInput, actorId: string) {
  const base = (await repo.maxSortOrder(db)) + 1;
  return repo.createEntry(db, {
    partner: input.partner.trim(),
    country: input.country?.trim() || null,
    redeemed: input.redeemed ?? 0,
    issued: input.issued ?? 0,
    refund: input.refund ?? 0,
    sortOrder: base,
    addedBy: actorId,
  });
}

export async function update(db: Db, id: string, input: UpdateVoucherEntryInput) {
  await getById(db, id);
  return repo.updateEntry(db, id, {
    ...(input.partner !== undefined && { partner: input.partner.trim() }),
    ...(input.country !== undefined && { country: input.country?.trim() || null }),
    ...(input.redeemed !== undefined && { redeemed: input.redeemed }),
    ...(input.issued !== undefined && { issued: input.issued }),
    ...(input.refund !== undefined && { refund: input.refund }),
  });
}

export async function remove(db: Db, id: string) {
  await getById(db, id);
  await repo.deleteEntry(db, id);
  return { success: true as const };
}

export async function archive(db: Db, id: string) {
  const existing = await repo.getEntry(db, id);
  if (!existing) throw new NotFoundException("Voucher entry not found");
  return repo.updateEntry(db, id, { archivedAt: existing.archivedAt ?? new Date().toISOString() });
}

export async function unarchive(db: Db, id: string) {
  await getById(db, id);
  return repo.updateEntry(db, id, { archivedAt: null });
}

export async function importRows(db: Db, input: ImportVoucherEntriesInput, actorId: string) {
  const base = (await repo.maxSortOrder(db)) + 1;
  let created = 0;
  for (let idx = 0; idx < input.rows.length; idx++) {
    const r = input.rows[idx]!;
    await repo.createEntry(db, {
      partner: r.partner.trim(),
      country: r.country?.trim() || null,
      redeemed: r.redeemed ?? 0,
      issued: r.issued ?? 0,
      refund: r.refund ?? 0,
      sortOrder: base + idx,
      addedBy: actorId,
    });
    created++;
  }
  return { created };
}

export async function reorder(db: Db, input: ReorderVoucherEntriesInput) {
  await repo.reorderEntries(db, input.orderedIds);
  return { success: true as const };
}
