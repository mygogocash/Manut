import { beforeEach, describe, expect, it, vi } from "vitest";

import { LegalAnnouncementService } from "@/modules/legal-announcements/legal-announcements.service";

const mocks = vi.hoisted(() => ({
  attachmentFindUnique: vi.fn(),
  ack: vi.fn(),
  create: vi.fn(),
  createSignedUrl: vi.fn(),
  findById: vi.fn(),
  requireRegisteredStorageUrl: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    legalAnnouncementAttachment: {
      findUnique: mocks.attachmentFindUnique,
    },
  },
}));

vi.mock("@/modules/legal-announcements/legal-announcements.repository", () => ({
  legalAnnouncementRepository: {
    ack: mocks.ack,
    create: mocks.create,
    findById: mocks.findById,
  },
}));

vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  STORAGE_BUCKETS: { DOCUMENTS: "documents" },
  createSignedUrl: mocks.createSignedUrl,
  requireRegisteredStorageUrl: mocks.requireRegisteredStorageUrl,
}));

describe("LegalAnnouncementService attachment storage provenance", () => {
  const service = new LegalAnnouncementService();
  const actorId = "11111111-1111-4111-8111-111111111111";
  const fileUrl =
    "https://manut.supabase.co/storage/v1/object/public/documents/announcements/policy.pdf";
  const visibleAnnouncement = {
    id: "announcement-1",
    title: "Policy update",
    body: "Read this",
    kind: "policy",
    entityId: "entity-1",
    status: "published",
    publishedAt: null,
    expiresAt: null,
    requiresAck: false,
    pinned: false,
    authorId: actorId,
    createdAt: new Date("2026-07-17T00:00:00.000Z"),
    updatedAt: new Date("2026-07-17T00:00:00.000Z"),
    author: null,
    entity: null,
    attachments: [],
    acks: [],
    _count: { acks: 0 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRegisteredStorageUrl.mockResolvedValue({
      bucket: "documents",
      path: "announcements/policy.pdf",
      uploadId: "upload-1",
    });
    mocks.findById.mockResolvedValue(visibleAnnouncement);
  });

  it("requires every new attachment to be an owned legal-announcement upload", async () => {
    const now = new Date("2026-07-17T00:00:00.000Z");
    mocks.create.mockResolvedValue({
      id: "announcement-1",
      title: "Policy update",
      body: "Read this",
      kind: "policy",
      entityId: null,
      status: "draft",
      publishedAt: null,
      expiresAt: null,
      requiresAck: false,
      pinned: false,
      authorId: actorId,
      createdAt: now,
      updatedAt: now,
      author: null,
      entity: null,
      attachments: [],
      acks: [],
      _count: { acks: 0 },
    });

    await service.create(
      {
        title: "Policy update",
        body: "Read this",
        kind: "policy",
        status: "draft",
        requiresAck: false,
        pinned: false,
        attachments: [{ fileUrl, fileName: "policy.pdf" }],
      },
      actorId,
    );

    expect(mocks.requireRegisteredStorageUrl).toHaveBeenCalledWith(fileUrl, {
      allowedBuckets: ["documents"],
      purpose: "legal-announcement",
      uploadedBy: actorId,
    });
    expect(mocks.create).toHaveBeenCalled();
  });

  it("revalidates attachment purpose before issuing a signed URL", async () => {
    mocks.attachmentFindUnique.mockResolvedValue({
      id: "attachment-1",
      announcementId: "announcement-1",
      fileUrl,
      fileName: "policy.pdf",
    });
    mocks.createSignedUrl.mockResolvedValue("https://signed.example/policy");

    await expect(
      service.getAttachmentDownloadUrl(
        "announcement-1",
        "attachment-1",
        actorId,
        "entity-1",
        false,
      ),
    ).resolves.toEqual({
      data: { url: "https://signed.example/policy", fileName: "policy.pdf" },
    });

    expect(mocks.requireRegisteredStorageUrl).toHaveBeenCalledWith(fileUrl, {
      allowedBuckets: ["documents"],
      purpose: "legal-announcement",
    });
  });

  it.each([
    {
      label: "cross-entity",
      row: { entityId: "entity-2" },
    },
    {
      label: "future",
      row: { publishedAt: new Date(Date.now() + 60_000) },
    },
    {
      label: "expired",
      row: { expiresAt: new Date(Date.now() - 60_000) },
    },
  ])("hides $label announcements from detail reads", async ({ row }) => {
    mocks.findById.mockResolvedValue({ ...visibleAnnouncement, ...row });

    await expect(
      service.getById("announcement-1", actorId, "entity-1", false),
    ).rejects.toThrow("Announcement not found");
  });

  it("does not acknowledge or sign a cross-entity announcement", async () => {
    mocks.findById.mockResolvedValue({
      ...visibleAnnouncement,
      entityId: "entity-2",
    });

    await expect(
      service.acknowledge("announcement-1", actorId, "entity-1", false, null),
    ).rejects.toThrow("Announcement not found");
    await expect(
      service.getAttachmentDownloadUrl(
        "announcement-1",
        "attachment-1",
        actorId,
        "entity-1",
        false,
      ),
    ).rejects.toThrow("Announcement not found");

    expect(mocks.ack).not.toHaveBeenCalled();
    expect(mocks.attachmentFindUnique).not.toHaveBeenCalled();
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });
});
