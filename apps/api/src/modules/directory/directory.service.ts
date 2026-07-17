import { NotFoundException } from "@/common/exceptions/http-exception";
import { directoryRepository } from "@/modules/directory/directory.repository";
import type { ListDirectoryQuery } from "@/modules/directory/directory.validation";

// salary + currency stay HR-only (compensation data).
// phone is HR-only OR visible when the employee opted in via phonePublic.
const HR_ONLY_FIELDS = ["salary", "currency"] as const;

function sanitize<T extends { phonePublic?: boolean | null }>(
  user: T,
  canViewSensitive: boolean,
): Omit<T, "salary" | "currency" | "phone" | "phonePublic"> & {
  phone?: T extends { phone: infer P } ? P : never;
} {
  const copy = { ...user } as Record<string, unknown>;
  if (!canViewSensitive) {
    for (const field of HR_ONLY_FIELDS) delete copy[field];
    if (!user.phonePublic) delete copy.phone;
  }
  // phonePublic itself is an internal flag — strip from the public response.
  delete copy.phonePublic;

  const manager = copy.manager;
  if (manager && typeof manager === "object" && !Array.isArray(manager)) {
    const managerRecord = manager as Record<string, unknown>;
    if (managerRecord.isActive !== true || managerRecord.deletedAt !== null) {
      copy.manager = null;
    } else {
      const publicManager = { ...managerRecord };
      delete publicManager.isActive;
      delete publicManager.deletedAt;
      copy.manager = publicManager;
    }
  }
  return copy as Omit<T, "salary" | "currency" | "phone" | "phonePublic"> & {
    phone?: T extends { phone: infer P } ? P : never;
  };
}

export class DirectoryService {
  async list(query: ListDirectoryQuery, canViewSensitive: boolean) {
    const { page, limit, ...filters } = query;
    const { data, total } = await directoryRepository.findAllEmployees(
      filters,
      page,
      limit,
    );

    const sanitized = data.map((user) => sanitize(user, canViewSensitive));

    return {
      data: sanitized,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Lean shape for assignee pickers. Never returns salary, phone, or
  // anything else HR considers sensitive — safe to expose without
  // `directory:read`.
  async listAssignable(query: ListDirectoryQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await directoryRepository.findAssignable(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAssignableById(id: string) {
    const user = await directoryRepository.findAssignableById(id);
    if (!user) throw new NotFoundException("Employee not found");
    return user;
  }

  async getById(id: string, canViewSensitive: boolean) {
    const user = await directoryRepository.findById(id);
    if (!user) throw new NotFoundException("Employee not found");

    return sanitize(user, canViewSensitive);
  }

  async getDepartments() {
    return directoryRepository.getDepartments();
  }

  async getOrgChart() {
    return directoryRepository.getOrgChart();
  }
}

export const directoryService = new DirectoryService();
