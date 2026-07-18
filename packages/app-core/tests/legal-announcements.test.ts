import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getLegalAnnouncement,
  listLegalAnnouncements,
} from "../src/legal-announcements/legal-announcements";

const announcement = {
  id: "clann000000000000000000001",
  title: "Handbook update",
  body: "<p>Full announcement body</p>",
  kind: "handbook",
  entityId: null,
  entity: null,
  status: "published",
  publishedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: null,
  requiresAck: true,
  pinned: true,
  authorId: "11111111-1111-4111-8111-111111111111",
  author: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alex Example",
    email: "alex@manut.example",
    avatarUrl: null,
  },
  attachments: [
    {
      id: "clatt000000000000000000001",
      announcementId: "clann000000000000000000001",
      fileUrl: "https://storage.example/documents/legal/handbook.pdf",
      fileName: "handbook.pdf",
      uploadedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  ackCount: 3,
  myAckedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("legal announcements foundation contracts", () => {
  it("lists announcements without body, acks, or attachments", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [announcement],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listLegalAnnouncements(client, {
      page: 1,
      limit: 20,
    });
    expect(result.data[0]).toEqual({
      id: announcement.id,
      title: "Handbook update",
      kind: "handbook",
      status: "published",
      pinned: true,
      requiresAck: true,
    });
    expect(result.data[0]).not.toHaveProperty("body");
    expect(result.data[0]).not.toHaveProperty("attachments");
    expect(result.data[0]).not.toHaveProperty("ackCount");
    expect(result.data[0]).not.toHaveProperty("myAckedAt");
    expect(result.data[0]).not.toHaveProperty("author");
    expect(get).toHaveBeenCalledWith(
      "/legal-announcements?page=1&limit=20",
      undefined,
    );
  });

  it("loads announcement detail with body but without author or file URLs", async () => {
    const get = vi.fn().mockResolvedValue({
      data: announcement,
    });
    const client = { get } as unknown as ApiClient;

    const result = await getLegalAnnouncement(
      client,
      "clann000000000000000000001",
    );
    expect(result.body).toBe("<p>Full announcement body</p>");
    expect(result.attachmentNames).toEqual(["handbook.pdf"]);
    expect(result).not.toHaveProperty("author");
    expect(result).not.toHaveProperty("ackCount");
    expect(get).toHaveBeenCalledWith(
      "/legal-announcements/clann000000000000000000001",
      undefined,
    );
  });
});
