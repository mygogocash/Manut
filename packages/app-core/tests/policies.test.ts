import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listCompanyPolicies } from "../src/policies/policies";

describe("company policies foundation contracts", () => {
  it("lists policies without file URLs or uploader email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "pol1",
          title: "Code of Conduct",
          category: "code_of_conduct",
          description: "Expected behavior",
          fileUrl: "https://storage.example/coc.pdf",
          fileName: "coc.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
          version: "1.0",
          effectiveDate: "2026-01-01",
          isActive: true,
          entity: { id: "e1", name: "Manut Ops", code: "OPS" },
          uploadedBy: {
            id: "u1",
            name: "Alex",
            email: "alex@manut.example",
          },
        },
      ],
    });
    const client = { get } as unknown as ApiClient;

    const result = await listCompanyPolicies(client);
    expect(result.data[0]).toEqual({
      id: "pol1",
      title: "Code of Conduct",
      category: "code_of_conduct",
      description: "Expected behavior",
      fileName: "coc.pdf",
      version: "1.0",
      effectiveDate: "2026-01-01",
      isActive: true,
      entityName: "Manut Ops",
    });
    expect(result.data[0]).not.toHaveProperty("fileUrl");
    expect(result.data[0]).not.toHaveProperty("uploadedBy");
    expect(get).toHaveBeenCalledWith("/policies", undefined);
  });
});
