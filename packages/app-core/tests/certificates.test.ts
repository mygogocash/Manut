import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listCertificates } from "../src/certificates/certificates";

describe("certificates foundation contracts", () => {
  it("lists certificates without message, file URL, or emails", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "cert1",
          title: "Ship award",
          type: "achievement",
          status: "issued",
          recipientName: "Alex Example",
          recipientEmail: "alex@manut.example",
          message: "Great work",
          fileUrl: "https://storage.example/cert.pdf",
          signatories: [{ name: "Boss", title: "CEO" }],
          issuedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listCertificates(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: "cert1",
      title: "Ship award",
      type: "achievement",
      status: "issued",
      recipientName: "Alex Example",
      issuedAt: "2026-03-01T00:00:00.000Z",
    });
    expect(result.data[0]).not.toHaveProperty("message");
    expect(result.data[0]).not.toHaveProperty("recipientEmail");
    expect(result.data[0]).not.toHaveProperty("fileUrl");
    expect(get).toHaveBeenCalledWith("/certificates?page=1&limit=20", undefined);
  });
});
