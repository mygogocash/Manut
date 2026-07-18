import { HttpError } from "../http-error";
import {
  CRM_TEAM_READ,
  DEALS_CREATE,
  DEALS_READ,
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
  };
}

export type DealsService = ReturnType<typeof createDealsService>;
