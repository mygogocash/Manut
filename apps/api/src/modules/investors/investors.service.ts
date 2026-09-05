import type { InputJsonValue, Prisma } from "@nexora/database";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { resolveFundraisingEntityKey } from "@/modules/fundraising-entities/fundraising-entities.service";
import { investorTagService } from "@/modules/investor-tags/investor-tags.service";
import {
  collectTagCodes,
  investorIdentity,
  labelForTagCode,
  planImport,
  sparseInvestorUpdate,
} from "@/modules/investors/investor-import";
import type { InvestorFilters } from "@/modules/investors/investors.repository";
import {
  buildInvestorWhere,
  investorsRepository,
} from "@/modules/investors/investors.repository";
import type {
  BulkDeleteInvestorsInput,
  BulkTagsInvestorsInput,
  BulkUpdateInvestorsInput,
  CreateInvestorInput,
  ImportInvestorsInput,
  ReorderInvestorsInput,
  UpdateInvestorInput,
} from "@/modules/investors/investors.validation";

function canReadAll(permissions: string[]): boolean {
  return permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
}

// Resolve a bulk selection to a Prisma where. Either an explicit id list
// or "all matching the filter". `ownerScope` (set for non read-all
// callers) is ANDed in both modes so a caller can never touch rows they
// don't own — even by passing foreign ids.
function bulkSelectionWhere(
  input: {
    ids?: string[];
    allMatching?: boolean;
    filter?: {
      search?: string;
      type?: string;
      status?: string;
      fundraisingEntity?: string;
      // `archived` and `tag` are part of the view the rep is looking at, so
      // they MUST travel with an allMatching selection or the action hits rows
      // the list never showed. They were reaching buildInvestorWhere through
      // the spread already; naming them here is what makes a typo'd facet a
      // compile error instead of a silently ignored key.
      archived?: boolean;
      tag?: string;
      // Sent by the pipeline board so "all matching" cannot reach rows whose
      // status has no column — see the note on InvestorFilters.statusIn.
      statusIn?: string[];
    };
  },
  ownerScope: string | undefined,
): Prisma.InvestorWhereInput {
  if (input.allMatching) {
    return buildInvestorWhere({ ...(input.filter ?? {}), addedBy: ownerScope });
  }
  return {
    id: { in: input.ids ?? [] },
    ...(ownerScope ? { addedBy: ownerScope } : {}),
  };
}

export const investorsService = {
  async list(
    actorId: string,
    actorPermissions: string[],
    page: number,
    limit: number,
    search?: string,
    type?: string,
    status?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    archived?: boolean,
    fundraisingEntity?: string,
    tag?: string,
  ) {
    // Without `investors:read-all`, callers only see investors they
    // added themselves. CEO/Admin keeps full visibility.
    const addedBy = canReadAll(actorPermissions) ? undefined : actorId;
    const { data, total } = await investorsRepository.findAll(
      page,
      limit,
      search,
      type,
      status,
      addedBy,
      sortBy,
      sortOrder,
      // Default view excludes archived; `archived=true` returns only archived.
      archived ?? false,
      fundraisingEntity,
      tag,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  // Per-stage est/act roll-up for the pipeline columns. Mirrors `list`
  // scoping so the totals match what the caller can actually see.
  async pipelineTotals(
    actorId: string,
    actorPermissions: string[],
    filters: Omit<InvestorFilters, "addedBy"> = {},
  ) {
    const addedBy = canReadAll(actorPermissions) ? undefined : actorId;
    // Takes the board's own facets so the column headers describe the same
    // rows as the cards under them. Previously only owner + entity reached
    // here, so a board filtered by type or tag showed unfiltered money.
    return investorsRepository.pipelineTotals({ ...filters, addedBy });
  },

  // Apply status / type / entity / owner to many investors at once (the
  // selection bar). Non read-all callers are scoped to investors they added.
  async bulkUpdate(
    actorId: string,
    actorPermissions: string[],
    input: BulkUpdateInvestorsInput,
  ) {
    // Reassigning the owner is an admin-style action.
    if (input.set.addedBy && !canReadAll(actorPermissions)) {
      throw new ForbiddenException(
        "Reassigning owner requires investors:read-all access.",
      );
    }
    // Resolve the target vehicle BEFORE the updateMany so a bad key
    // 400s instead of moving the whole selection onto a dead tab.
    const fundraisingEntity =
      input.set.fundraisingEntity !== undefined
        ? await resolveFundraisingEntityKey(input.set.fundraisingEntity)
        : undefined;
    const ownerScope = canReadAll(actorPermissions) ? undefined : actorId;
    const where = bulkSelectionWhere(input, ownerScope);

    // How many rows the selection covers, measured BEFORE the archive
    // narrowing below, so the caller can be told "8 updated, 2 already
    // archived" rather than silently acting on a subset.
    //
    // Only archive/restore narrows its where, so only it can skip anything —
    // every other field writes to every matched row. Counting unconditionally
    // would add a query to each of those for a number that is always zero.
    const selected =
      input.set.archived !== undefined
        ? await investorsRepository.countInvestors(where)
        : undefined;

    // Archiving is idempotent on the single-row path via
    // `existing.archivedAt ?? new Date()`. An updateMany cannot express
    // "keep whatever is already there" per row, so narrow the WHERE instead:
    // only touch rows that are not already in the target state. Without this,
    // bulk-archiving a selection that happens to contain archived rows
    // silently rewrites their archive dates to today.
    if (input.set.archived !== undefined) {
      where.archivedAt = input.set.archived ? null : { not: null };
    }

    const data: Prisma.InvestorUncheckedUpdateManyInput = {
      ...(input.set.status !== undefined && { status: input.set.status }),
      ...(input.set.type !== undefined && { type: input.set.type }),
      ...(fundraisingEntity !== undefined && { fundraisingEntity }),
      ...(input.set.addedBy !== undefined && { addedBy: input.set.addedBy }),
      ...(input.set.archived !== undefined && {
        archivedAt: input.set.archived ? new Date() : null,
      }),
    };
    const result = await investorsRepository.bulkUpdate(where, data);
    // `updated` is kept as the first key for the existing callers that read
    // it; `skipped` is only ever non-zero for archive/restore, the one field
    // whose where is narrowed.
    return {
      updated: result.count,
      selected: selected ?? result.count,
      skipped: selected === undefined ? 0 : selected - result.count,
      failed: [],
    };
  },

  /**
   * Add or replace tags across a selection.
   *
   * `replace` is a plain updateMany — one value written to every matched row.
   *
   * `add` is a per-row UNION, which a single `updateMany` cannot express: each
   * investor keeps what it already carries plus the requested codes. It runs
   * one guarded statement per code inside ONE transaction — appending only
   * where the code is absent, which preserves each row's existing tag order
   * and cannot duplicate an entry (Postgres arrays are not sets).
   *
   * Unlike the Sales CRM equivalent this does NOT loop through the
   * single-record update: an investor's tags have no child rows and no
   * roll-up to recompute, so there is no `syncBusinessUnitsAfterWrite`
   * analogue that a set-based write would bypass.
   */
  async bulkSetTags(
    actorId: string,
    actorPermissions: string[],
    input: BulkTagsInvestorsInput,
  ) {
    const ownerScope = canReadAll(actorPermissions) ? undefined : actorId;
    const where = bulkSelectionWhere(input, ownerScope);
    const selected = await investorsRepository.countInvestors(where);

    if (input.mode === "replace") {
      await investorsRepository.bulkUpdate(where, { tags: input.codes });
      // Every matched row is written unconditionally — that is what replace
      // means — so nothing is skipped. Prisma cannot express "already exactly
      // this set", and reporting a skip count that was not measured would be
      // worse than reporting none.
      return { selected, updated: selected, skipped: 0, failed: [] };
    }

    const codes = [...new Set(input.codes)];
    if (codes.length === 0) {
      return { selected, updated: 0, skipped: selected, failed: [] };
    }

    // Count the rows that will actually change BEFORE writing: those missing
    // at least one requested code. Counting after the writes would return
    // zero, because by then every row carries them all.
    const updated = await investorsRepository.countInvestors({
      AND: [where, { NOT: { tags: { hasEvery: codes } } }],
    });

    // One guarded statement per code, all in a single transaction. Each is
    // set-based and idempotent, so a selection mixing tagged and untagged rows
    // lands correctly without a per-row round trip — and a failure part-way
    // through rolls the whole batch back rather than leaving some codes
    // applied with no record of which.
    await investorsRepository.addTagCodes(where, codes);

    return { selected, updated, skipped: selected - updated, failed: [] };
  },

  async bulkDelete(
    actorId: string,
    actorPermissions: string[],
    input: BulkDeleteInvestorsInput,
  ) {
    const ownerScope = canReadAll(actorPermissions) ? undefined : actorId;
    const where = bulkSelectionWhere(input, ownerScope);
    const result = await investorsRepository.bulkDelete(where);
    return { deleted: result.count };
  },

  async getById(id: string, actorId: string, actorPermissions: string[]) {
    const investor = await investorsRepository.findById(id);
    if (!investor) throw new NotFoundException("Investor not found");
    if (!canReadAll(actorPermissions) && investor.addedBy !== actorId) {
      throw new ForbiddenException("You can only view investors you added");
    }
    return investor;
  },

  async create(addedBy: string, input: CreateInvestorInput) {
    const fundraisingEntity = await resolveFundraisingEntityKey(
      input.fundraisingEntity,
    );
    return investorsRepository.create({
      name: input.name,
      type: input.type,
      status: input.status,
      visibility: input.visibility,
      contactName: input.contactName || undefined,
      contactEmail: input.contactEmail || undefined,
      contactPhone: input.contactPhone || undefined,
      website: input.website || undefined,
      location: input.location || undefined,
      notes: input.notes as InputJsonValue,
      // Pipeline-master columns (2026-05-28). Empty strings convert
      // to null so a cleared field on edit lands as null, not an
      // empty string that would fail downstream URL / date pickers.
      title: input.title || null,
      linkedinUrl: input.linkedinUrl || null,
      revenueStream: input.revenueStream || null,
      lastContactDate: input.lastContactDate
        ? new Date(input.lastContactDate)
        : null,
      nextAction: input.nextAction || null,
      actInvestment: input.actInvestment || null,
      estInvestment: input.estInvestment || null,
      crossSell: input.crossSell || null,
      region: input.region || null,
      notesText: input.notesText || null,
      // Enumerated like every other field above, which is exactly how this
      // was missed once: `tags` reached createInvestorSchema, passed
      // validation, and was then silently dropped here — the import created
      // 5 rows with `tags: []` and no error anywhere. Prisma's create input
      // has `tags` optional, so there was no type error to catch it either.
      // `update` never had the bug because it spreads `...rest`.
      tags: input.tags ?? [],
      fundraisingEntity,
      addedBy,
    });
  },

  async update(
    id: string,
    input: UpdateInvestorInput,
    actorId: string,
    actorPermissions: string[],
  ) {
    const existing = await investorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Investor not found");
    if (!canReadAll(actorPermissions) && existing.addedBy !== actorId) {
      throw new ForbiddenException("You can only edit investors you added");
    }
    // `fundraisingEntity` is pulled out of the spread so it can be
    // resolved against the catalog first — `updateInvestorSchema` is a
    // `.partial()` of create, so without this an unknown key would land
    // straight in the column and strand the row on a tab that doesn't
    // exist.
    const { lastContactDate, fundraisingEntity, ...rest } = input;
    return investorsRepository.update(id, {
      ...rest,
      notes: input.notes as InputJsonValue,
      // String fields go through unchanged — Prisma maps "" → empty
      // string; the repo treats undefined as "do not touch". Date
      // gets the same `""` → `null` treatment as create.
      ...(lastContactDate !== undefined && {
        lastContactDate: lastContactDate ? new Date(lastContactDate) : null,
      }),
      ...(fundraisingEntity !== undefined && {
        fundraisingEntity: await resolveFundraisingEntityKey(fundraisingEntity),
      }),
    });
  },

  async delete(id: string, actorId: string, actorPermissions: string[]) {
    const existing = await investorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Investor not found");
    if (!canReadAll(actorPermissions) && existing.addedBy !== actorId) {
      throw new ForbiddenException("You can only delete investors you added");
    }
    return investorsRepository.delete(id);
  },

  // Reversible archive. Reuses the SAME owner-or-read-all guard as
  // update/delete (no new permission) — a non-read-all caller can only
  // archive investors they added. Idempotent: re-archiving keeps the
  // original archive time. Archive is orthogonal to the pipeline `status`,
  // which is left untouched.
  async archive(id: string, actorId: string, actorPermissions: string[]) {
    const existing = await investorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Investor not found");
    if (!canReadAll(actorPermissions) && existing.addedBy !== actorId) {
      throw new ForbiddenException("You can only archive investors you added");
    }
    return investorsRepository.update(id, {
      archivedAt: existing.archivedAt ?? new Date(),
    });
  },

  async unarchive(id: string, actorId: string, actorPermissions: string[]) {
    const existing = await investorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Investor not found");
    if (!canReadAll(actorPermissions) && existing.addedBy !== actorId) {
      throw new ForbiddenException("You can only restore investors you added");
    }
    return investorsRepository.update(id, { archivedAt: null });
  },

  // Bulk import from the xlsx / csv import dialog. Each row goes
  // through the same `create()` path the form uses so unique
  // constraints + JSON `notes` coercion stay consistent. Rows that
  // raise are counted under `skipped` rather than failing the whole
  // batch — the team can re-import the deltas once they fix the bad
  // rows. The actor's id is stamped on every created row so the
  // `addedBy` ownership scoping still applies.
  /**
   * Dry run: decide insert-vs-update per row and report what a commit would do.
   *
   * Writes nothing, and in particular creates NO tag catalog rows — a preview
   * the user abandons must leave no trace in a shared catalog.
   */
  async previewImport(input: ImportInvestorsInput) {
    const { plans, missingTags } = await this.planImportRows(input.rows);
    return {
      rows: plans,
      missingTags,
      summary: {
        total: plans.length,
        inserts: plans.filter((p) => !p.errors.length && p.action === "insert")
          .length,
        updates: plans.filter((p) => !p.errors.length && p.action === "update")
          .length,
        invalid: plans.filter((p) => p.errors.length > 0).length,
        tagsToCreate: missingTags.length,
      },
    };
  },

  /** Shared plan step, so preview and commit cannot disagree. */
  async planImportRows(rows: ImportInvestorsInput["rows"]) {
    const resolved = await Promise.all(
      rows.map(async (r) => ({
        name: r.name,
        fundraisingEntity: await resolveFundraisingEntityKey(
          r.fundraisingEntity,
        ),
        linkedinUrl: r.linkedinUrl,
        tags: r.tags,
      })),
    );

    const existing = await investorsRepository.findImportMatches();
    const byKey = new Map<string, string>();
    for (const e of existing) {
      // Index under BOTH tiers so a row identified by LinkedIn and a row
      // identified by (name, entity) each find their record. `investorIdentity`
      // decides which tier a given row uses.
      const li = investorIdentity({ linkedinUrl: e.linkedinUrl });
      const nm = investorIdentity({
        name: e.name,
        fundraisingEntity: e.fundraisingEntity,
      });
      // First wins: a pre-existing duplicate in the table is a data problem,
      // and an import must not pick arbitrarily between the two on each run.
      for (const k of [li?.key, nm?.key]) {
        if (k && !byKey.has(k)) byKey.set(k, e.id);
      }
    }

    const known = new Set(
      (await investorTagService.list({ includeInactive: true })).map(
        (t) => t.code,
      ),
    );

    return {
      plans: planImport(resolved, byKey),
      missingTags: collectTagCodes(resolved).filter((c) => !known.has(c)),
    };
  },

  /**
   * Commit the import.
   *
   * Still called `bulkCreate` because the route and the dialog call it, but it
   * no longer only creates. Four things were wrong and all four were invisible
   * from outside:
   *
   *  - No match step, so re-running an import made a second copy of every row.
   *    It now UPSERTS on (name, fundraising entity).
   *  - An update reused the create payload, writing null over the pipeline
   *    stage, amounts and notes the sheet knows nothing about. Updates now go
   *    through `sparseInvestorUpdate`, and tags MERGE rather than replace.
   *  - The body was `catch {}` incrementing a counter, so a file that failed
   *    validation entirely reported a number and no reason. Errors are returned
   *    per row.
   *  - Tag codes on a row are open strings with no FK, so a code backed by no
   *    catalog entry saved fine but rendered as a raw slug and never appeared
   *    in the tag filter. Missing codes are added to the catalog.
   */
  async bulkCreate(addedBy: string, input: ImportInvestorsInput) {
    const { plans, missingTags } = await this.planImportRows(input.rows);

    const tagsCreated: string[] = [];
    if (input.createMissingTags !== false) {
      for (const code of missingTags) {
        try {
          await investorTagService.create({
            code,
            label: labelForTagCode(code),
          });
          tagsCreated.push(code);
        } catch {
          // A concurrent import may have created it between plan and commit.
          // The tag existing is the desired end state either way.
        }
      }
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ row: number; name: string; errors: string[] }> = [];

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i]!;
      const row = input.rows[i]!;
      if (plan.errors.length > 0) {
        skipped++;
        errors.push({ row: plan.row, name: plan.name, errors: plan.errors });
        continue;
      }
      try {
        if (plan.action === "update" && plan.matchedId) {
          const existing = await investorsRepository.findById(plan.matchedId);
          await investorsRepository.update(
            plan.matchedId,
            sparseInvestorUpdate(
              row as unknown as Record<string, unknown>,
              existing?.tags ?? [],
            ),
          );
          updated++;
        } else {
          await this.create(addedBy, row);
          created++;
        }
      } catch (err) {
        skipped++;
        errors.push({
          row: plan.row,
          name: plan.name,
          errors: [err instanceof Error ? err.message : "Unknown error"],
        });
      }
    }
    return { created, updated, skipped, errors, tagsCreated };
  },

  async dashboard(fundraisingEntity?: string) {
    return investorsRepository.dashboardKpis(fundraisingEntity);
  },

  // Persist the BD team's manual ordering. Reps without
  // `investors:read-all` may only reorder rows they added; if any
  // submitted id falls outside that scope, reject the batch so a
  // partial write can't leave the grid half-arranged. Mirrors the
  // sales-crm reorder guard.
  async reorder(
    actorId: string,
    permissions: string[],
    input: ReorderInvestorsInput,
  ) {
    const canReorderAll = canReadAll(permissions);
    if (!canReorderAll) {
      const owned = await investorsRepository.findIdsOwnedBy(
        input.orderedIds,
        actorId,
      );
      if (owned.length !== input.orderedIds.length) {
        throw new BadRequestException(
          "Reorder includes investors you didn't add. Drop the unowned rows or ask for investors:read-all access.",
        );
      }
    }
    await investorsRepository.reorder(input.orderedIds);
    return { success: true };
  },
};
