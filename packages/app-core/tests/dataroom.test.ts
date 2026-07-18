import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  dataRoomDocumentSchema,
  listDataRoomDocuments,
} from "../src/dataroom/dataroom";

const document = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Series A deck",
  description: "Investor pitch",
  category: "pitch",
  fileUrl: "https://storage.example.com/secret-path/deck.pdf",
  fileSize: 204800,
  mimeType: "application/pdf",
  version: 2,
  uploadedAt: "2026-07-01T00:00:00.000Z",
  uploader: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
};

describe("dataroom foundation contracts", () => {
  it("keeps list fields and strips fileUrl/uploader email", () => {
    const parsed = dataRoomDocumentSchema.parse(document);
    expect(parsed).toEqual({
      id: document.id,
      name: "Series A deck",
      description: "Investor pitch",
      category: "pitch",
      fileSize: 204800,
      mimeType: "application/pdf",
      version: 2,
      uploadedAt: "2026-07-01T00:00:00.000Z",
      uploader: { id: document.uploader.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("fileUrl");
  });

  it("lists dataroom documents with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [document],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listDataRoomDocuments(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ name: "Series A deck" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/dataroom?page=1&limit=20", { signal });
  });
});
