import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────────────────────

export interface ContactAccountRef {
  id: string;
  name: string;
  ownerId: string;
}

export interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  account: ContactAccountRef;
}

export interface CreateContactInput {
  accountId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  isPrimary?: boolean;
  notes?: string;
}

// accountId is set on create; the API prevents re-targeting under a
// different account, so it's omitted from the update body.
export type UpdateContactInput = Partial<Omit<CreateContactInput, "accountId">>;

export interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  accountId?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// ─── Service ────────────────────────────────────────────────────────────

export async function listContacts(
  params: ListContactsParams = {},
): Promise<ApiPaginatedResponse<Contact>> {
  return api.get(`/sales-revenue/contacts${buildQuery(params)}`);
}

export async function getContact(
  id: string,
): Promise<ApiSuccessResponse<Contact>> {
  return api.get(`/sales-revenue/contacts/${id}`);
}

export async function createContact(
  input: CreateContactInput,
): Promise<ApiSuccessResponse<Contact>> {
  return api.post("/sales-revenue/contacts", input);
}

export async function updateContact(
  id: string,
  input: UpdateContactInput,
): Promise<ApiSuccessResponse<Contact>> {
  return api.put(`/sales-revenue/contacts/${id}`, input);
}

export async function deleteContact(id: string): Promise<void> {
  await api.delete(`/sales-revenue/contacts/${id}`);
}
