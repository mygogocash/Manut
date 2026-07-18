import { HttpError } from "../http-error";
import { canReadVisa } from "./access";
import type { VisaListRecord, VisaStore } from "./store";

function asDate(value: string | null): string | null {
  if (value == null) return null;
  return value.slice(0, 10);
}

/**
 * Client projection for employee self-list: strip storage/document URLs and
 * employee email. Downloads stay on Express signed-url; HR company-wide lists
 * remain proxied (email may appear there for parity).
 */
function serializeRecord(raw: VisaListRecord): Record<string, unknown> {
  const hasLegacyDocument =
    typeof raw.documentUrl === "string" && raw.documentUrl.trim() !== "";
  return {
    id: raw.id,
    holderType: raw.holderType,
    holderName: raw.holderName,
    holderRelationship: raw.holderRelationship,
    visaType: raw.visaType,
    country: raw.country,
    nationality: raw.nationality,
    issueDate: asDate(raw.issueDate),
    expiryDate: asDate(raw.expiryDate),
    workPermitExpiryDate: asDate(raw.workPermitExpiryDate),
    status: raw.status,
    hasDocument: hasLegacyDocument || raw.documents.length > 0,
    documents: raw.documents.map((doc) => ({
      name: doc.name,
      category: doc.category,
    })),
    employee: {
      id: raw.employeeId,
      name: raw.employeeName,
    },
    entity: raw.entityId
      ? { id: raw.entityId, name: raw.entityName ?? "" }
      : null,
  };
}

export function createVisaService(store: VisaStore) {
  return {
    async list(
      userId: string,
      query: {
        page: number;
        limit: number;
        status?: string;
        search?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!canReadVisa(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      // Strict self-scope on the Hyperdrive path. HR company-wide stays proxied.
      const { data, total } = await store.findMany(
        {
          employeeId: userId,
          status: query.status,
          search: query.search,
        },
        query.page,
        query.limit,
      );

      return {
        data: data.map(serializeRecord),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },
  };
}

export type VisaService = ReturnType<typeof createVisaService>;
