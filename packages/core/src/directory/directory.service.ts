import type { ListDirectoryQuery } from "@nexora/contracts/modules/directory/directory.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import * as repo from "./directory.repository";

const HR_ONLY_FIELDS = ["salary", "currency"] as const;

function sanitize<T extends { phonePublic?: boolean | null }>(
  user: T,
  canViewSensitive: boolean,
): Omit<T, "salary" | "currency" | "phone" | "phonePublic"> & {
  phone?: T extends { phone: infer P } ? P : never;
} {
  const copy = { ...user } as Record<string, unknown>;
  if (!canViewSensitive) {
    for (const field of HR_ONLY_FIELDS) delete copy[field];
    if (!user.phonePublic) delete copy.phone;
  }
  delete copy.phonePublic;
  return copy as Omit<T, "salary" | "currency" | "phone" | "phonePublic"> & {
    phone?: T extends { phone: infer P } ? P : never;
  };
}

export async function list(db: Db, query: ListDirectoryQuery, canViewSensitive: boolean) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findAllEmployees(db, filters, page, limit);
  return {
    data: data.map((user) => sanitize(user, canViewSensitive)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function listAssignable(db: Db, query: ListDirectoryQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findAssignable(db, filters, page, limit);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getAssignableById(db: Db, id: string) {
  const user = await repo.findAssignableById(db, id);
  if (!user) throw new NotFoundException("Employee not found");
  return user;
}

export async function getById(db: Db, id: string, canViewSensitive: boolean) {
  const user = await repo.findById(db, id);
  if (!user) throw new NotFoundException("Employee not found");
  return sanitize(user, canViewSensitive);
}

export async function getDepartments(db: Db) {
  return repo.getDepartments(db);
}

export async function getOrgChart(db: Db) {
  return repo.getOrgChart(db);
}
