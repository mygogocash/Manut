import { HttpError } from "../http-error";
import {
  CRM_TEAM_READ,
  DEALS_CREATE,
  DEALS_READ,
  DEALS_UPDATE,
  hasDealPermission,
} from "./access";
import type { DealRecord, DealsStore } from "./store";

const DEAL_STAGES = new Set([
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
]);

function assertPermission(permissions: Set<string>, permission: string): void {
  if (!hasDealPermission(permissions, permission)) {
    throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
  }
}

/**
 * Client projection: strip notes and owner email (matches app-core dealSchema).
 */
function serializeDeal(raw: DealRecord): Record<string, unknown> {
  return {
    id: raw.id,
    company: raw.company,
    contact: raw.contact,
    value: raw.value,
    stage: raw.stage,
    probability: raw.probability,
    type: raw.type,
    country: raw.country,
    closeDate: raw.closeDate,
    owner: {
      id: raw.ownerId,
      name: raw.ownerName,
    },
  };
}

export function createDealsService(store: DealsStore) {
  return {
    async list(
      userId: string,
      query: {
        page: number;
        limit: number;
        search?: string;
        stage?: string;
        type?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, DEALS_READ);

      const canSeeAll = hasDealPermission(permissions, CRM_TEAM_READ);
      const { data, total } = await store.findMany(
        {
          search: query.search,
          stage: query.stage,
          type: query.type,
          ownerScope: canSeeAll ? undefined : [userId],
        },
        query.page,
        query.limit,
      );

      return {
        data: data.map(serializeDeal),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },

    async getById(userId: string, id: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, DEALS_READ);

      const deal = await store.findById(id);
      if (!deal) {
        throw new HttpError(404, "NOT_FOUND", "Deal not found");
      }

      const canSeeAll = hasDealPermission(permissions, CRM_TEAM_READ);
      // 404 (not 403) when the actor lacks scope — mirrors Express.
      if (!canSeeAll && deal.ownerId !== userId) {
        throw new HttpError(404, "NOT_FOUND", "Deal not found");
      }

      return { data: serializeDeal(deal) };
    },

    async pipeline(userId: string) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, DEALS_READ);

      const canSeeAll = hasDealPermission(permissions, CRM_TEAM_READ);
      const ownerScope = canSeeAll ? undefined : [userId];
      const data = await store.pipelineSummary(ownerScope);
      return { data };
    },

    async create(
      userId: string,
      input: {
        company: string;
        contact?: string;
        value: number;
        stage?: string;
        probability?: number;
        type?: string;
        country?: string;
        partnerId?: string;
        closeDate?: string;
        notes?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, DEALS_CREATE);

      const company = input.company.trim();
      if (!company) {
        throw new HttpError(400, "INVALID_DEAL", "Company name is required.");
      }
      if (!Number.isFinite(input.value) || input.value < 0) {
        throw new HttpError(400, "INVALID_DEAL", "Value must be non-negative.");
      }

      const stage = input.stage ?? "lead";
      if (!DEAL_STAGES.has(stage)) {
        throw new HttpError(400, "INVALID_DEAL", "Invalid deal stage.");
      }

      const probability = input.probability ?? 10;
      if (
        !Number.isInteger(probability) ||
        probability < 0 ||
        probability > 100
      ) {
        throw new HttpError(
          400,
          "INVALID_DEAL",
          "Probability must be an integer from 0 to 100.",
        );
      }

      if (
        input.closeDate !== undefined &&
        !/^\d{4}-\d{2}-\d{2}$/u.test(input.closeDate)
      ) {
        throw new HttpError(
          400,
          "INVALID_DEAL",
          "closeDate must be YYYY-MM-DD.",
        );
      }

      const created = await store.create({
        company,
        contact: input.contact?.trim() || undefined,
        value: input.value,
        stage,
        probability,
        type: input.type?.trim() || undefined,
        country: input.country?.trim() || undefined,
        partnerId: input.partnerId,
        closeDate: input.closeDate,
        notes: input.notes,
        ownerId: userId,
      });

      return { data: serializeDeal(created) };
    },

    async update(
      userId: string,
      id: string,
      input: {
        company?: string;
        contact?: string | null;
        value?: number;
        stage?: string;
        probability?: number;
        type?: string | null;
        country?: string | null;
        partnerId?: string | null;
        closeDate?: string | null;
        notes?: string | null;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      assertPermission(permissions, DEALS_UPDATE);

      const existing = await store.findById(id);
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", "Deal not found");
      }
      const canSeeAll = hasDealPermission(permissions, CRM_TEAM_READ);
      if (!canSeeAll && existing.ownerId !== userId) {
        throw new HttpError(404, "NOT_FOUND", "Deal not found");
      }

      if (input.company !== undefined && !input.company.trim()) {
        throw new HttpError(400, "INVALID_DEAL", "Company name is required.");
      }
      if (
        input.value !== undefined &&
        (!Number.isFinite(input.value) || input.value < 0)
      ) {
        throw new HttpError(400, "INVALID_DEAL", "Value must be non-negative.");
      }
      if (input.stage !== undefined && !DEAL_STAGES.has(input.stage)) {
        throw new HttpError(400, "INVALID_DEAL", "Invalid deal stage.");
      }
      if (
        input.probability !== undefined &&
        (!Number.isInteger(input.probability) ||
          input.probability < 0 ||
          input.probability > 100)
      ) {
        throw new HttpError(
          400,
          "INVALID_DEAL",
          "Probability must be an integer from 0 to 100.",
        );
      }
      if (
        input.closeDate !== undefined &&
        input.closeDate !== null &&
        !/^\d{4}-\d{2}-\d{2}$/u.test(input.closeDate)
      ) {
        throw new HttpError(
          400,
          "INVALID_DEAL",
          "closeDate must be YYYY-MM-DD.",
        );
      }

      const updated = await store.update(id, {
        ...(input.company !== undefined && { company: input.company.trim() }),
        ...(input.contact !== undefined && {
          contact: input.contact?.trim() || null,
        }),
        ...(input.value !== undefined && { value: input.value }),
        ...(input.stage !== undefined && { stage: input.stage }),
        ...(input.probability !== undefined && {
          probability: input.probability,
        }),
        ...(input.type !== undefined && {
          type: input.type?.trim() || null,
        }),
        ...(input.country !== undefined && {
          country: input.country?.trim() || null,
        }),
        ...(input.partnerId !== undefined && { partnerId: input.partnerId }),
        ...(input.closeDate !== undefined && { closeDate: input.closeDate }),
        ...(input.notes !== undefined && { notes: input.notes }),
      });

      return { data: serializeDeal(updated) };
    },
  };
}

export type DealsService = ReturnType<typeof createDealsService>;
