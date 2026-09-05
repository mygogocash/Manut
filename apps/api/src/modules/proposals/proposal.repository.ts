import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import {
  IN_FLIGHT_STATUSES,
  PROPOSAL_STATUS,
  type ProposalStatus,
} from "@/modules/proposals/proposal.types";

// Prisma access for proposals.
//
// Reads and simple writes live here per the module convention. The status
// transitions deliberately do NOT: they compose several operations into one
// `$transaction` and belong next to the legality and authority checks that guard
// them, in proposal.service.ts. Splitting them would put half a transaction in
// each file.

const listSelect = {
  id: true,
  title: true,
  type: true,
  priority: true,
  status: true,
  statusChangedAt: true,
  createdAt: true,
  raisedById: true,
  projectId: true,
} satisfies Prisma.ProposalSelect;

export interface ProposalFilters {
  search?: string;
  type?: string;
}

/**
 * What lets a caller see something in their "pending" queue.
 *
 * Being named on a pending stage is the normal answer. The two extras exist so
 * nothing becomes invisible: a super-grant holder oversees the whole flow, and a
 * proposal raised before chains has no stages to be named on, so the codes that
 * used to gate the fixed tiers still surface it.
 */
export interface PendingScope {
  superGrant: boolean;
  legacyCodes: boolean;
}

export class ProposalRepository {
  create(data: {
    title: string;
    description: string;
    type: string;
    projectId?: string | null;
    priority?: string | null;
    raisedById: string;
  }) {
    return prisma.proposal.create({
      data: {
        ...data,
        // Creating a proposal submits it. There is no draft to strand.
        status: PROPOSAL_STATUS.PENDING_APPROVAL,
        statusChangedAt: new Date(),
      },
      select: { ...listSelect, description: true },
    });
  }

  findById(id: string) {
    return prisma.proposal.findUnique({
      where: { id },
      select: {
        ...listSelect,
        description: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
    });
  }

  update(
    id: string,
    data: {
      title?: string;
      description?: string;
      type?: string;
      projectId?: string | null;
      priority?: string | null;
    },
  ) {
    // `statusChangedAt` is deliberately untouched: an edit is not a status
    // change, and stamping it here would corrupt time-in-stage.
    return prisma.proposal.update({
      where: { id },
      data,
      select: { ...listSelect, description: true },
    });
  }

  /**
   * Build the row filter for one queue view.
   *
   * `pending` and `answering` are the two that are not simple status filters:
   * the first depends on which stages the caller can decide at, the second on
   * questions assigned to them. Both are passed in rather than derived here, so
   * this stays a pure query builder.
   */
  /**
   * Proposals awaiting a decision from THIS person.
   *
   * Identity, not status: which stage a proposal sits at is a snapshot row, so
   * "waiting on me" is a filtered relation rather than a status comparison. It
   * used to be derived from the caller's permission codes, which stopped working
   * the moment who-decides-what became configurable per stage.
   */
  private pendingWhere(
    userId: string,
    scope: PendingScope,
  ): Prisma.ProposalWhereInput {
    const inFlight: Prisma.ProposalWhereInput = {
      status: { in: IN_FLIGHT_STATUSES },
    };
    if (scope.superGrant) return inFlight;

    const ors: Prisma.ProposalWhereInput[] = [
      {
        approvalDecisions: {
          some: { approverUserId: userId, status: "pending" },
        },
      },
    ];
    // A proposal with no snapshot follows the pre-chain rules, so a holder of the
    // old codes still sees it rather than it disappearing from every queue.
    if (scope.legacyCodes) ors.push({ approvalDecisions: { none: {} } });

    return { AND: [inFlight, { OR: ors }] };
  }

  private whereFor(
    view: string,
    userId: string,
    scope: PendingScope,
    filters: ProposalFilters,
  ): Prisma.ProposalWhereInput {
    const clauses: Prisma.ProposalWhereInput[] = [];

    switch (view) {
      case "mine":
        clauses.push({ raisedById: userId });
        break;
      case "pending":
        clauses.push(this.pendingWhere(userId, scope));
        break;
      case "answering":
        clauses.push({
          informationRequests: {
            some: { assignedToId: userId, respondedAt: null },
          },
        });
        break;
      case "approved":
        clauses.push({ status: PROPOSAL_STATUS.APPROVED });
        break;
      case "declined":
        clauses.push({ status: PROPOSAL_STATUS.DECLINED });
        break;
      default:
        break;
    }

    if (filters.type) clauses.push({ type: filters.type });
    if (filters.search) {
      clauses.push({
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
        ],
      });
    }

    return clauses.length ? { AND: clauses } : {};
  }

  /**
   * Rows for one view plus the counts for every view, so the tab badges cost no
   * extra round trips.
   *
   * Four of the six counts come from a single `groupBy` on status. `mine` and
   * `answering` need their own, because one filters on the raiser and the other
   * on a child table: neither is answerable from a status tally.
   */
  async listQueue(
    userId: string,
    view: string,
    scope: PendingScope,
    filters: ProposalFilters,
  ) {
    const scoped = (v: string) => this.whereFor(v, userId, scope, filters);

    const [rows, byStatus, mine, answering, pending] = await Promise.all([
      prisma.proposal.findMany({
        where: scoped(view),
        select: {
          ...listSelect,
          // A filtered relation count, so "waiting on 2 answers" costs one
          // aggregate rather than a query per row.
          _count: {
            select: { informationRequests: { where: { respondedAt: null } } },
          },
        },
        orderBy: [{ statusChangedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.proposal.groupBy({
        by: ["status"],
        where: scoped("list"),
        _count: { _all: true },
      }),
      prisma.proposal.count({ where: scoped("mine") }),
      prisma.proposal.count({ where: scoped("answering") }),
      // Its own count now: "waiting on me" is a relation filter, so it cannot be
      // read off the status tally.
      prisma.proposal.count({ where: scoped("pending") }),
    ]);

    const tally = new Map(byStatus.map((g) => [g.status, g._count._all]));
    const at = (s: ProposalStatus) => tally.get(s) ?? 0;

    return {
      rows,
      counts: {
        list: [...tally.values()].reduce((a, b) => a + b, 0),
        mine,
        pending,
        answering,
        approved: at(PROPOSAL_STATUS.APPROVED),
        declined: at(PROPOSAL_STATUS.DECLINED),
      },
    };
  }

  /** Open questions assigned to one person, across every proposal. */
  openQuestionsFor(userId: string) {
    return prisma.proposalInformationRequest.findMany({
      where: { assignedToId: userId, respondedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        proposalId: true,
        question: true,
        askedById: true,
        createdAt: true,
        proposal: { select: { id: true, title: true, status: true } },
      },
    });
  }

  /**
   * Resolve display names for a set of user ids in one query.
   *
   * User references on proposals are plain scalars, so names are joined here
   * rather than by the database. One batched lookup per request, never one per
   * row.
   */
  async namesById(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const users = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(users.map((u) => [u.id, u.name]));
  }
}

export const proposalRepository = new ProposalRepository();
