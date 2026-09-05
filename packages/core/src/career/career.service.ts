import type { Db } from "@nexora/db";
import type {
  CreateJobInput,
  JobQuery,
  UpdateJobInput,
} from "@nexora/contracts/modules/career/career.validation";
import { NotFoundException } from "../http-exception";
import { rowsToCsv } from "../lib/csv";
import * as repo from "./career.repository";

export async function listJobs(db: Db, query: JobQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findJobs(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getJobById(db: Db, id: string) {
  const job = await repo.findJobById(db, id);
  if (!job) throw new NotFoundException("Job not found");
  return job;
}

export async function createJob(db: Db, input: CreateJobInput) {
  return repo.createJob(db, {
    title: input.title,
    slug: input.slug,
    type: input.type,
    location: input.location,
    department: input.department,
    description: input.description,
    active: input.active,
  });
}

export async function updateJob(db: Db, id: string, input: UpdateJobInput) {
  const job = await repo.findJobById(db, id);
  if (!job) throw new NotFoundException("Job not found");
  return repo.updateJob(db, id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.slug !== undefined && { slug: input.slug }),
    ...(input.type !== undefined && { type: input.type }),
    ...(input.location !== undefined && { location: input.location }),
    ...(input.department !== undefined && { department: input.department }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.active !== undefined && { active: input.active }),
  });
}

export async function deleteJob(db: Db, id: string) {
  const job = await repo.findJobById(db, id);
  if (!job) throw new NotFoundException("Job not found");
  await repo.deleteJob(db, id);
}

export async function getJobTitles(db: Db) {
  return repo.findJobTitles(db);
}

export async function exportCsv(db: Db, params?: { search?: string }) {
  const rows = await repo.findAllForExport(db, params?.search);
  const headers = [
    "ID", "Title", "Slug", "Type", "Department", "Location", "Active", "Applications", "Created At", "Updated At",
  ];
  const data = rows.map((j) => [
    j.id, j.title, j.slug ?? "", j.type, j.department, j.location,
    j.active ? "Yes" : "No", j._count.applications, j.createdAt, j.updatedAt,
  ]);
  return rowsToCsv(headers, data);
}
