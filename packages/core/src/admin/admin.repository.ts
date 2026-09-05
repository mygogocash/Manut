import { and, asc, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";

const auditUser = alias(schema.users, "audit_user");
const groupCreator = alias(schema.users, "group_creator");
const memberUser = alias(schema.users, "member_user");

export async function findAuditLogs(
  db: Db,
  page: number,
  limit: number,
  filters?: { resource?: string; userId?: string; action?: string },
) {
  const parts = [];
  if (filters?.resource) parts.push(ilike(schema.auditLog.resource, `%${filters.resource}%`));
  if (filters?.userId) parts.push(eq(schema.auditLog.userId, filters.userId));
  if (filters?.action) parts.push(eq(schema.auditLog.action, filters.action));
  const where = parts.length ? and(...parts) : undefined;
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: schema.auditLog.id,
      userId: schema.auditLog.userId,
      action: schema.auditLog.action,
      resource: schema.auditLog.resource,
      resourceId: schema.auditLog.resourceId,
      details: schema.auditLog.details,
      ipAddress: schema.auditLog.ipAddress,
      userAgent: schema.auditLog.userAgent,
      timestamp: schema.auditLog.timestamp,
      userName: auditUser.name,
      userEmail: auditUser.email,
    })
    .from(schema.auditLog)
    .leftJoin(auditUser, eq(schema.auditLog.userId, auditUser.id))
    .where(where)
    .orderBy(desc(schema.auditLog.timestamp))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db.select({ n: count() }).from(schema.auditLog).where(where);
  const data = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    action: r.action,
    resource: r.resource,
    resourceId: r.resourceId,
    details: r.details,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    createdAt: r.timestamp,
    user: r.userId ? { id: r.userId, name: r.userName, email: r.userEmail } : null,
  }));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findAllSettings(db: Db) {
  return db.select().from(schema.systemSettings).orderBy(asc(schema.systemSettings.key));
}

export async function upsertSettings(db: Db, settings: Array<{ key: string; value: unknown }>) {
  for (const s of settings) {
    const now = new Date().toISOString();
    const [existing] = await db
      .select({ key: schema.systemSettings.key })
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, s.key))
      .limit(1);
    if (existing) {
      await db.update(schema.systemSettings).set({ value: s.value, updatedAt: now }).where(eq(schema.systemSettings.key, s.key));
    } else {
      await db.insert(schema.systemSettings).values({ key: s.key, value: s.value, updatedAt: now });
    }
  }
}

export async function findModuleAccessByUser(db: Db, userId: string) {
  return db
    .select({
      moduleId: schema.moduleAccess.moduleId,
      granted: schema.moduleAccess.granted,
      grantedAt: schema.moduleAccess.grantedAt,
    })
    .from(schema.moduleAccess)
    .where(eq(schema.moduleAccess.userId, userId))
    .orderBy(asc(schema.moduleAccess.moduleId));
}

export async function upsertModuleAccess(
  db: Db,
  userId: string,
  modules: Array<{ moduleId: string; granted: boolean }>,
  grantedBy: string,
) {
  const now = new Date().toISOString();
  for (const m of modules) {
    await db
      .insert(schema.moduleAccess)
      .values({ userId, moduleId: m.moduleId, granted: m.granted, grantedBy, grantedAt: now })
      .onConflictDoUpdate({
        target: [schema.moduleAccess.userId, schema.moduleAccess.moduleId],
        set: { granted: m.granted, grantedBy, grantedAt: now },
      });
  }
}

export async function findUserGroups(db: Db) {
  const groups = await db
    .select({
      id: schema.userGroups.id,
      name: schema.userGroups.name,
      description: schema.userGroups.description,
      isActive: schema.userGroups.isActive,
      createdBy: schema.userGroups.createdBy,
      createdAt: schema.userGroups.createdAt,
      updatedAt: schema.userGroups.updatedAt,
      creatorName: groupCreator.name,
      creatorEmail: groupCreator.email,
      memberCount: sql<number>`(select count(*) from ${schema.userGroupMembers} m where m.group_id = ${schema.userGroups.id})`,
    })
    .from(schema.userGroups)
    .innerJoin(groupCreator, eq(schema.userGroups.createdBy, groupCreator.id))
    .orderBy(asc(schema.userGroups.name));

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    isActive: g.isActive,
    createdBy: g.createdBy,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    creator: { id: g.createdBy, name: g.creatorName, email: g.creatorEmail },
    _count: { members: Number(g.memberCount) },
  }));
}

export async function findUserGroupById(db: Db, id: string) {
  const [g] = await db
    .select({
      id: schema.userGroups.id,
      name: schema.userGroups.name,
      description: schema.userGroups.description,
      isActive: schema.userGroups.isActive,
      createdBy: schema.userGroups.createdBy,
      createdAt: schema.userGroups.createdAt,
      updatedAt: schema.userGroups.updatedAt,
      creatorName: groupCreator.name,
      creatorEmail: groupCreator.email,
    })
    .from(schema.userGroups)
    .innerJoin(groupCreator, eq(schema.userGroups.createdBy, groupCreator.id))
    .where(eq(schema.userGroups.id, id))
    .limit(1);
  if (!g) return null;

  const members = await db
    .select({
      userId: schema.userGroupMembers.userId,
      addedAt: schema.userGroupMembers.addedAt,
      name: memberUser.name,
      email: memberUser.email,
      department: memberUser.department,
    })
    .from(schema.userGroupMembers)
    .innerJoin(memberUser, eq(schema.userGroupMembers.userId, memberUser.id))
    .where(eq(schema.userGroupMembers.groupId, id))
    .orderBy(desc(schema.userGroupMembers.addedAt));

  return {
    id: g.id,
    name: g.name,
    description: g.description,
    isActive: g.isActive,
    createdBy: g.createdBy,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    creator: { id: g.createdBy, name: g.creatorName, email: g.creatorEmail },
    members: members.map((m) => ({
      userId: m.userId,
      addedAt: m.addedAt,
      user: { id: m.userId, name: m.name, email: m.email, department: m.department },
    })),
    _count: { members: members.length },
  };
}

export async function createUserGroup(db: Db, data: { name: string; description?: string; createdBy: string }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.userGroups).values({
    id,
    name: data.name,
    description: data.description ?? null,
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  return findUserGroupById(db, id);
}

export async function updateUserGroup(
  db: Db,
  id: string,
  data: { name?: string; description?: string; isActive?: boolean },
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  await db.update(schema.userGroups).set(patch).where(eq(schema.userGroups.id, id));
  return findUserGroupById(db, id);
}

export async function deleteUserGroup(db: Db, id: string) {
  await db.delete(schema.userGroupMembers).where(eq(schema.userGroupMembers.groupId, id));
  await db.delete(schema.userGroups).where(eq(schema.userGroups.id, id));
}

export async function addGroupMembers(db: Db, groupId: string, userIds: string[], addedBy: string) {
  const now = new Date().toISOString();
  for (const userId of userIds) {
    await db
      .insert(schema.userGroupMembers)
      .values({ groupId, userId, addedBy, addedAt: now })
      .onConflictDoNothing();
  }
}

export async function removeGroupMembers(db: Db, groupId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  await db
    .delete(schema.userGroupMembers)
    .where(and(eq(schema.userGroupMembers.groupId, groupId), inArray(schema.userGroupMembers.userId, userIds)));
}
