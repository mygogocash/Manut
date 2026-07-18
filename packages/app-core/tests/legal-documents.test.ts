import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listLegalDocuments,
  listSharedLegalDocuments,
} from "../src/legal/legal-documents";

const document = {
  id: "leg1",
  title: "Master NDA",
  kind: "nda",
  status: "active",
  reference: "NDA-1",
  effectiveDate: "2026-01-01",
  expiryDate: "2027-01-01",
  effectiveExpiry: "2027-01-01",
  folder: "Contracts",
  notes: "internal only",
  fileUrl: "https://storage.example/nda.pdf",
  fileName: "nda.pdf",
  entity: { id: "e1", name: "Manut Ops" },
  owner: { id: "u1", name: "Alex", email: "alex@manut.example" },
  attachments: [],
  shares: [],
};

describe("legal documents foundation contracts", () => {
  it("lists documents without notes, file URLs, or owner email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [document],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listLegalDocuments(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: "leg1",
      title: "Master NDA",
      kind: "nda",
      status: "active",
      reference: "NDA-1",
      effectiveDate: "2026-01-01",
      expiryDate: "2027-01-01",
      folder: "Contracts",
      entityName: "Manut Ops",
    });
    expect(result.data[0]).not.toHaveProperty("notes");
    expect(result.data[0]).not.toHaveProperty("fileUrl");
    expect(result.data[0]).not.toHaveProperty("owner");
    expect(get).toHaveBeenCalledWith("/legal?page=1&limit=20", undefined);
  });

  it("lists shared documents via shared-with-me", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [document],
      meta: { page: 1, limit: 20, total: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await listSharedLegalDocuments(client);
    expect(get).toHaveBeenCalledWith(
      "/legal/shared-with-me?page=1&limit=20",
      undefined,
    );
  });
});
