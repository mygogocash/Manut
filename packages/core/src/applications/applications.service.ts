import type { Db } from "@nexora/db";
import type { ApplicationQuery } from "@nexora/contracts/modules/applications/applications.validation";
import { NotFoundException } from "../http-exception";
import { rowsToCsv } from "../lib/csv";
import * as repo from "./applications.repository";

export async function listApplications(db: Db, query: ApplicationQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findApplications(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getApplicationById(db: Db, id: string) {
  const app = await repo.findApplicationById(db, id);
  if (!app) throw new NotFoundException("Application not found");
  return app;
}

export async function deleteApplication(db: Db, id: string) {
  const app = await repo.findApplicationById(db, id);
  if (!app) throw new NotFoundException("Application not found");
  await repo.deleteApplication(db, id);
}

export async function exportCsv(db: Db, params?: { jobId?: string; search?: string }) {
  const rows = await repo.findAllForExport(db, params ?? {});
  const headers = [
    "ID", "Name", "Email", "Mobile", "LinkedIn", "Website",
    "Position", "Department", "Location", "Resume", "Applied At",
  ];
  const data = rows.map((a) => [
    a.id, a.name, a.email, a.mobile, a.linkedin ?? "", a.website ?? "",
    a.job.title, a.job.department, a.job.location, a.attachment, a.createdAt,
  ]);
  return rowsToCsv(headers, data);
}
