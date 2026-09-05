import { and, asc, count, desc, eq, exists, ilike, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";

type DbLike = Db | DbTransaction;
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";
import {
  IN_FLIGHT_STATUSES,
  PROPOSAL_STATUS,
  type ProposalStatus,
} from "@nexora/contracts/modules/proposals/proposal.types";

const proposals = schema.proposals;
const infoRequests = schema.proposalInformationRequests;
const transitions = schema.proposalTransitions;
const decisions = schema.approvalChainDecisions;
const projects = schema.projects;
const users = schema.users;

function nowIso() {
  return new Date().toISOString();
}

export interface PendingScope {
  superGrant: boolean;
  legacyCodes: boolean;
}

export interface ProposalFilters {
  search?: string;
  type?: string;
}

function searchWhere(filters: ProposalFilters) {
  if (!filters.search?.trim()) return undefined;
  const q = `%${filters.search.trim()}%`;
  return or(ilike(proposals.title, q), ilike(proposals.description, q));
}

function pendingWhere(db: Db, userId: string, scope: PendingScope) {
  const inFlight = inArray(proposals.status, IN_FLIGHT_STATUSES);
  if (scope.superGrant) return inFlight;

  const parts = [
    exists(
      db
        .select({ id: decisions.id })
        .from(decisions)
        .where(
          and(
            eq(decisions.proposalId, proposals.id),
            eq(decisions.approverUserId, userId),
            eq(decisions.status, "pending"),
          ),
        ),
    ),
  ];
  if (scope.legacyCodes) {
    parts.push(
      notExists(
        db.select({ id: decisions.id }).from(decisions).where(eq(decisions.proposalId, proposals.id)),
      ),
    );
  }
  return and(inFlight, or(...parts));
}

function whereFor(
  db: Db,
  view: string,
  userId: string,
  scope: PendingScope,
  filters: ProposalFilters,
) {
  const clauses = [];
  switch (view) {
    case "mine":
      clauses.push(eq(proposals.raisedById, userId));
      break;
    case "pending":
      clauses.push(pendingWhere(db, userId, scope));
      break;
    case "answering":
      clauses.push(
        exists(
          db
            .select({ id: infoRequests.id })
            .from(infoRequests)
            .where(
              and(
                eq(infoRequests.proposalId, proposals.id),
                eq(infoRequests.assignedToId, userId),
                isNull(infoRequests.respondedAt),
              ),
            ),
        ),
      );
      break;
    case "approved":
      clauses.push(eq(proposals.status, PROPOSAL_STATUS.APPROVED));
      break;
    case "declined":
      clauses.push(eq(proposals.status, PROPOSAL_STATUS.DECLINED));
      break;
    default:
      break;
  }
  if (filters.type) clauses.push(eq(proposals.type, filters.type));
  const search = searchWhere(filters);
  if (search) clauses.push(search);
  return clauses.length ? and(...clauses) : undefined;
}

export async function create(
  db: Db,
  data: {
    title: string;
    description: string;
    type: string;
    projectId?: string | null;
    priority?: string | null;
    raisedById: string;
  },
) {
  const id = createCuid();
  const ts = nowIso();
  const [row] = await db
    .insert(proposals)
    .values({
      id,
      title: data.title,
      description: data.description,
      type: data.type,
      projectId: data.projectId ?? null,
      priority: data.priority ?? null,
      raisedById: data.raisedById,
      status: PROPOSAL_STATUS.PENDING_APPROVAL,
      statusChangedAt: ts,
      updatedAt: ts,
    })
    .returning();
  return row!;
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select({
      proposal: proposals,
      projectName: projects.name,
    })
    .from(proposals)
    .leftJoin(projects, eq(proposals.projectId, projects.id))
    .where(eq(proposals.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.proposal,
    project: row.proposal.projectId ? { id: row.proposal.projectId, name: row.projectName } : null,
  };
}

export async function update(
  db: Db,
  id: string,
  data: {
    title?: string;
    description?: string;
    type?: string;
    projectId?: string | null;
    priority?: string | null;
  },
) {
  const [row] = await db
    .update(proposals)
    .set({ ...data, updatedAt: nowIso() })
    .where(eq(proposals.id, id))
    .returning();
  return row ?? null;
}

export async function listQueue(
  db: Db,
  userId: string,
  view: string,
  scope: PendingScope,
  filters: ProposalFilters,
) {
  const scoped = (v: string) => whereFor(db, v, userId, scope, filters);

  const [rows, byStatus, [mineRow], [answeringRow], [pendingRow]] = await Promise.all([
    db
      .select()
      .from(proposals)
      .where(scoped(view))
      .orderBy(desc(proposals.statusChangedAt), desc(proposals.createdAt))
      .limit(200),
    db
      .select({ status: proposals.status, c: count() })
      .from(proposals)
      .where(scoped("list"))
      .groupBy(proposals.status),
    db.select({ c: count() }).from(proposals).where(scoped("mine")),
    db.select({ c: count() }).from(proposals).where(scoped("answering")),
    db.select({ c: count() }).from(proposals).where(scoped("pending")),
  ]);

  const openCounts = await openQuestionCounts(
    db,
    rows.map((r) => r.id),
  );

  const tally = new Map(byStatus.map((g) => [g.status, Number(g.c)]));
  const at = (s: ProposalStatus) => tally.get(s) ?? 0;

  return {
    rows: rows.map((r) => ({ ...r, openQuestionCount: openCounts.get(r.id) ?? 0 })),
    counts: {
      list: [...tally.values()].reduce((a, b) => a + b, 0),
      mine: Number(mineRow?.c ?? 0),
      pending: Number(pendingRow?.c ?? 0),
      answering: Number(answeringRow?.c ?? 0),
      approved: at(PROPOSAL_STATUS.APPROVED),
      declined: at(PROPOSAL_STATUS.DECLINED),
    },
  };
}

async function openQuestionCounts(db: Db, proposalIds: string[]) {
  const map = new Map<string, number>();
  if (proposalIds.length === 0) return map;
  const rows = await db
    .select({ proposalId: infoRequests.proposalId, c: count() })
    .from(infoRequests)
    .where(and(inArray(infoRequests.proposalId, proposalIds), isNull(infoRequests.respondedAt)))
    .groupBy(infoRequests.proposalId);
  for (const r of rows) map.set(r.proposalId, Number(r.c));
  return map;
}

export async function openQuestionsFor(db: Db, userId: string) {
  const rows = await db
    .select({
      id: infoRequests.id,
      proposalId: infoRequests.proposalId,
      question: infoRequests.question,
      askedById: infoRequests.askedById,
      createdAt: infoRequests.createdAt,
      proposalTitle: proposals.title,
      proposalStatus: proposals.status,
    })
    .from(infoRequests)
    .innerJoin(proposals, eq(infoRequests.proposalId, proposals.id))
    .where(and(eq(infoRequests.assignedToId, userId), isNull(infoRequests.respondedAt)))
    .orderBy(asc(infoRequests.createdAt));
  return rows.map((r) => ({
    id: r.id,
    proposalId: r.proposalId,
    question: r.question,
    askedById: r.askedById,
    createdAt: r.createdAt,
    proposal: { id: r.proposalId, title: r.proposalTitle, status: r.proposalStatus },
  }));
}

export async function namesById(db: Db, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique));
  for (const u of rows) map.set(u.id, u.name);
  return map;
}

export async function findProposalCore(db: DbLike, id: string) {
  const [row] = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      status: proposals.status,
      raisedById: proposals.raisedById,
    })
    .from(proposals)
    .where(eq(proposals.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateStatus(
  db: DbLike,
  id: string,
  from: ProposalStatus,
  data: { status: ProposalStatus; currentStepOrder: number | null },
) {
  const ts = nowIso();
  const updated = await db
    .update(proposals)
    .set({
      status: data.status,
      statusChangedAt: ts,
      currentStepOrder: data.currentStepOrder,
      updatedAt: ts,
    })
    .where(and(eq(proposals.id, id), eq(proposals.status, from)))
    .returning({ id: proposals.id });
  return updated.length;
}

export async function setCurrentStepOrder(db: DbLike, id: string, order: number | null) {
  await db.update(proposals).set({ currentStepOrder: order, updatedAt: nowIso() }).where(eq(proposals.id, id));
}

export async function listInformationRequests(db: Db, proposalId: string) {
  return db
    .select()
    .from(infoRequests)
    .where(eq(infoRequests.proposalId, proposalId))
    .orderBy(asc(infoRequests.createdAt));
}

export async function listTransitions(db: Db, proposalId: string) {
  return db
    .select()
    .from(transitions)
    .where(eq(transitions.proposalId, proposalId))
    .orderBy(asc(transitions.createdAt));
}

export async function createInformationRequests(
  db: Db,
  rows: Array<{
    proposalId: string;
    askedById: string;
    assignedToId: string;
    raisedAtStatus: string;
    question: string;
  }>,
) {
  const ts = nowIso();
  const values = rows.map((r) => ({ id: createCuid(), ...r, createdAt: ts }));
  return db.insert(infoRequests).values(values).returning();
}

export async function findInformationRequest(db: Db, id: string) {
  const [row] = await db
    .select({
      req: infoRequests,
      proposalStatus: proposals.status,
    })
    .from(infoRequests)
    .innerJoin(proposals, eq(infoRequests.proposalId, proposals.id))
    .where(eq(infoRequests.id, id))
    .limit(1);
  if (!row) return null;
  return { ...row.req, proposal: { status: row.proposalStatus } };
}

export async function answerInformationRequest(db: Db, id: string, response: string) {
  const ts = nowIso();
  const [row] = await db
    .update(infoRequests)
    .set({ response, respondedAt: ts })
    .where(and(eq(infoRequests.id, id), isNull(infoRequests.respondedAt)))
    .returning();
  return row ?? null;
}

export async function createTransition(
  db: DbLike,
  data: {
    proposalId: string;
    fromStatus: string | null;
    toStatus: string;
    actorId: string | null;
    choice: string | null;
    comment: string | null;
  },
) {
  const [row] = await db
    .insert(transitions)
    .values({ id: createCuid(), ...data, createdAt: nowIso() })
    .returning();
  return row!;
}

export async function activeUserIds(db: Db, ids: string[]) {
  if (ids.length === 0) return [] as string[];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.isActive, true)));
  return rows.map((r) => r.id);
}

export async function projectExists(db: Db, projectId: string) {
  const [row] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  return !!row;
}
