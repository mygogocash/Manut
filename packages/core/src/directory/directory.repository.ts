import { and, asc, count, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";

const manager = alias(schema.users, "directory_manager");
const entity = alias(schema.entities, "directory_entity");

export type DirectoryFilters = {
  search?: string;
  entityId?: string;
  department?: string;
};

function buildWhere(filters: DirectoryFilters) {
  const parts = [eq(schema.users.isActive, true)];
  if (filters.entityId) parts.push(eq(schema.users.entityId, filters.entityId));
  if (filters.department) parts.push(eq(schema.users.department, filters.department));
  if (filters.search) {
    const q = `%${filters.search}%`;
    parts.push(or(ilike(schema.users.name, q), ilike(schema.users.email, q), ilike(schema.users.department, q))!);
  }
  return and(...parts);
}

export async function findAllEmployees(db: Db, filters: DirectoryFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      phone: schema.users.phone,
      phonePublic: schema.users.phonePublic,
      department: schema.users.department,
      jobTitle: schema.users.jobTitle,
      employeeId: schema.users.employeeId,
      employmentType: schema.users.employmentType,
      location: schema.users.location,
      country: schema.users.country,
      isActive: schema.users.isActive,
      startDate: schema.users.startDate,
      salary: schema.users.salary,
      currency: schema.users.currency,
      entityId: entity.id,
      entityName: entity.name,
      entityCode: entity.code,
      managerId: manager.id,
      managerName: manager.name,
      managerEmail: manager.email,
      managerJobTitle: manager.jobTitle,
      managerAvatarUrl: manager.avatarUrl,
    })
    .from(schema.users)
    .leftJoin(entity, eq(schema.users.entityId, entity.id))
    .leftJoin(manager, eq(schema.users.reportingTo, manager.id))
    .where(where)
    .orderBy(asc(schema.users.name))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db.select({ n: count() }).from(schema.users).where(where);
  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    avatarUrl: r.avatarUrl,
    phone: r.phone,
    phonePublic: r.phonePublic,
    department: r.department,
    jobTitle: r.jobTitle,
    employeeId: r.employeeId,
    employmentType: r.employmentType,
    location: r.location,
    country: r.country,
    isActive: r.isActive,
    startDate: r.startDate,
    salary: r.salary,
    currency: r.currency,
    entity: r.entityId ? { id: r.entityId, name: r.entityName!, code: r.entityCode! } : null,
    manager: r.managerId
      ? { id: r.managerId, name: r.managerName!, email: r.managerEmail!, jobTitle: r.managerJobTitle, avatarUrl: r.managerAvatarUrl }
      : null,
  }));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findAssignable(db: Db, filters: DirectoryFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      jobTitle: schema.users.jobTitle,
    })
    .from(schema.users)
    .where(where)
    .orderBy(asc(schema.users.name))
    .limit(limit)
    .offset(offset);
  const [totalRow] = await db.select({ n: count() }).from(schema.users).where(where);
  return { data: rows, total: Number(totalRow?.n ?? 0) };
}

export async function findAssignableById(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      jobTitle: schema.users.jobTitle,
    })
    .from(schema.users)
    .where(and(eq(schema.users.id, id), eq(schema.users.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function findById(db: Db, id: string) {
  const [base] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      phone: schema.users.phone,
      phonePublic: schema.users.phonePublic,
      department: schema.users.department,
      jobTitle: schema.users.jobTitle,
      employeeId: schema.users.employeeId,
      employmentType: schema.users.employmentType,
      location: schema.users.location,
      country: schema.users.country,
      isActive: schema.users.isActive,
      startDate: schema.users.startDate,
      salary: schema.users.salary,
      currency: schema.users.currency,
      timezone: schema.users.timezone,
      metadata: schema.users.metadata,
      createdAt: schema.users.createdAt,
      entityId: entity.id,
      entityName: entity.name,
      entityCode: entity.code,
      managerId: manager.id,
      managerName: manager.name,
      managerEmail: manager.email,
      managerJobTitle: manager.jobTitle,
      managerAvatarUrl: manager.avatarUrl,
    })
    .from(schema.users)
    .leftJoin(entity, eq(schema.users.entityId, entity.id))
    .leftJoin(manager, eq(schema.users.reportingTo, manager.id))
    .where(eq(schema.users.id, id))
    .limit(1);
  if (!base) return null;

  const directReports = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      jobTitle: schema.users.jobTitle,
      avatarUrl: schema.users.avatarUrl,
      department: schema.users.department,
    })
    .from(schema.users)
    .where(and(eq(schema.users.reportingTo, id), eq(schema.users.isActive, true)))
    .orderBy(asc(schema.users.name));

  const roleRows = await db
    .select({ roleId: schema.roles.id, roleName: schema.roles.name })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
    .where(eq(schema.userRoles.userId, id));

  return {
    id: base.id,
    name: base.name,
    email: base.email,
    avatarUrl: base.avatarUrl,
    phone: base.phone,
    phonePublic: base.phonePublic,
    department: base.department,
    jobTitle: base.jobTitle,
    employeeId: base.employeeId,
    employmentType: base.employmentType,
    location: base.location,
    country: base.country,
    isActive: base.isActive,
    startDate: base.startDate,
    salary: base.salary,
    currency: base.currency,
    timezone: base.timezone,
    metadata: base.metadata,
    createdAt: base.createdAt,
    entity: base.entityId ? { id: base.entityId, name: base.entityName!, code: base.entityCode! } : null,
    manager: base.managerId
      ? { id: base.managerId, name: base.managerName!, email: base.managerEmail!, jobTitle: base.managerJobTitle, avatarUrl: base.managerAvatarUrl }
      : null,
    directReports,
    userRoles: roleRows.map((r) => ({ role: { id: r.roleId, name: r.roleName } })),
  };
}

const CANONICAL = [
  "Management", "Legal", "Marketing", "HR", "Accounting", "Finance",
  "Product", "Project Management", "Digital Social", "Business Team", "IT",
];

export async function getDepartments(db: Db) {
  const rows = await db
    .select({ department: schema.users.department, n: count() })
    .from(schema.users)
    .where(and(eq(schema.users.isActive, true), isNotNull(schema.users.department)))
    .groupBy(schema.users.department)
    .orderBy(asc(schema.users.department));

  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.department) counts.set(r.department, Number(r.n));
  }
  const result: Array<{ name: string; count: number }> = [];
  const seen = new Set<string>();
  for (const name of CANONICAL) {
    result.push({ name, count: counts.get(name) ?? 0 });
    seen.add(name);
  }
  for (const [name, c] of counts) {
    if (!seen.has(name)) result.push({ name, count: c });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOrgChart(db: Db) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      jobTitle: schema.users.jobTitle,
      department: schema.users.department,
      avatarUrl: schema.users.avatarUrl,
      reportingTo: schema.users.reportingTo,
      entityId: entity.id,
      entityName: entity.name,
      entityCode: entity.code,
    })
    .from(schema.users)
    .leftJoin(entity, eq(schema.users.entityId, entity.id))
    .where(eq(schema.users.isActive, true))
    .orderBy(asc(schema.users.name))
    .then((rows) =>
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        jobTitle: r.jobTitle,
        department: r.department,
        avatarUrl: r.avatarUrl,
        reportingTo: r.reportingTo,
        entity: r.entityId ? { id: r.entityId, name: r.entityName!, code: r.entityCode! } : null,
      })),
    );
}
