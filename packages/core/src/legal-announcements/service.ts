import type { Db } from "@nexora/db";

export async function list(db: Db, _userId: string, _perms: string[], query: { page?: number; limit?: number }) {
  return { data: [], meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } };
}

export async function getById(db: Db, id: string) {
  return { id };
}

export async function dashboard(db: Db) {
  return { ok: true };
}
