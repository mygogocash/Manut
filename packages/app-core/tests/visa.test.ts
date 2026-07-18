import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getVisa,
  getVisaDownloadUrl,
  listVisas,
} from "../src/visa/visa";

const record = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  employeeId: "11111111-1111-4111-8111-111111111111",
  holderType: "employee",
  holderName: null,
  holderRelationship: null,
  visaType: "work_visa",
  country: "Thailand",
  nationality: "Thai",
  issueDate: "2025-01-15",
  expiryDate: "2027-01-14",
  workPermitNumber: "WP-1",
  workPermitIssueDate: "2025-01-15",
  workPermitExpiryDate: "2027-01-14",
  status: "active",
  documentUrl: "r2://private/doc.pdf",
  documents: [
    {
      name: "Passport",
      url: "r2://private/passport.pdf",
      category: "passport_front",
    },
  ],
  notes: "internal hr note",
  entityId: "entity-1",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
  },
  entity: { id: "entity-1", name: "Manut" },
  createdAt: "2025-01-15T00:00:00.000Z",
  updatedAt: "2025-01-15T00:00:00.000Z",
};

describe("visa foundation contracts", () => {
  it("lists projected visa records and strips notes and storage urls", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [record],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listVisas(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: record.id,
      holderType: "employee",
      holderName: null,
      holderRelationship: null,
      visaType: "work_visa",
      country: "Thailand",
      nationality: "Thai",
      issueDate: "2025-01-15",
      expiryDate: "2027-01-14",
      workPermitExpiryDate: "2027-01-14",
      status: "active",
      documentCount: 1,
      hasDocument: true,
      employee: {
        id: record.employee.id,
        name: "Person",
        email: "person@manut.example",
      },
      entityName: "Manut",
    });
    expect(result.data[0]).not.toHaveProperty("notes");
    expect(result.data[0]).not.toHaveProperty("documentUrl");
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/visa?"),
      undefined,
    );
  });

  it("accepts employee self-list projections without email and with hasDocument", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          ...record,
          documentUrl: undefined,
          hasDocument: true,
          documents: [{ name: "Passport", category: "passport_front" }],
          employee: { id: record.employee.id, name: "Person" },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listVisas(client);
    expect(result.data[0]).toMatchObject({
      id: record.id,
      documentCount: 1,
      hasDocument: true,
      employee: { id: record.employee.id, name: "Person" },
    });
    expect(result.data[0]?.employee).not.toHaveProperty("email");
    expect(result.data[0]).not.toHaveProperty("documentUrl");
  });

  it("loads detail with document names only", async () => {
    const get = vi.fn().mockResolvedValue({ data: record });
    const client = { get } as unknown as ApiClient;

    const detail = await getVisa(client, record.id);
    expect(detail).toMatchObject({
      id: record.id,
      visaType: "work_visa",
      status: "active",
      documents: [{ name: "Passport", category: "passport_front" }],
      hasLegacyDocument: true,
    });
    expect(detail.documents[0]).not.toHaveProperty("url");
    expect(detail).not.toHaveProperty("notes");
    expect(get).toHaveBeenCalledWith(`/visa/${record.id}`, undefined);
  });

  it("requests a signed download url for a document index", async () => {
    const get = vi.fn().mockResolvedValue({
      data: { url: "https://signed.example/doc", name: "Passport" },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      getVisaDownloadUrl(client, record.id, { docIndex: 0 }),
    ).resolves.toEqual({
      url: "https://signed.example/doc",
      name: "Passport",
    });
    expect(get).toHaveBeenCalledWith(
      `/visa/${record.id}/download?docIndex=0`,
      undefined,
    );
  });
});
