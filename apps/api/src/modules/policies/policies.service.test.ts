import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { PoliciesService } from "@/modules/policies/policies.service";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  createSignedUrl: vi.fn(),
  findById: vi.fn(),
  requireRegisteredStorageUrl: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { user: { findUnique: mocks.userFindUnique } },
}));

vi.mock("@/modules/policies/policies.repository", () => ({
  policiesRepository: {
    create: mocks.create,
    findById: mocks.findById,
  },
}));

vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  STORAGE_BUCKETS: { DOCUMENTS: "documents" },
  createSignedUrl: mocks.createSignedUrl,
  requireRegisteredStorageUrl: mocks.requireRegisteredStorageUrl,
}));

describe("PoliciesService storage provenance", () => {
  const service = new PoliciesService();
  const actorId = "11111111-1111-4111-8111-111111111111";
  const fileUrl =
    "https://manut.supabase.co/storage/v1/object/public/documents/policies/handbook.pdf";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRegisteredStorageUrl.mockResolvedValue({
      bucket: "documents",
      path: "policies/handbook.pdf",
      uploadId: "upload-1",
    });
    mocks.userFindUnique.mockResolvedValue({ entityId: "entity-1" });
  });

  it("requires an owned company-policy upload before create", async () => {
    mocks.create.mockResolvedValue({ id: "policy-1" });

    await service.create(
      {
        title: "Handbook",
        category: "handbook",
        fileUrl,
        fileName: "handbook.pdf",
        isActive: true,
      },
      actorId,
    );

    expect(mocks.requireRegisteredStorageUrl).toHaveBeenCalledWith(fileUrl, {
      allowedBuckets: ["documents"],
      purpose: "company-policy",
      uploadedBy: actorId,
    });
    expect(mocks.create).toHaveBeenCalled();
  });

  it("revalidates policy purpose before issuing a signed URL", async () => {
    mocks.findById.mockResolvedValue({
      id: "policy-1",
      fileUrl,
      entityId: "entity-1",
      isActive: true,
    });
    mocks.createSignedUrl.mockResolvedValue("https://signed.example/policy");

    await expect(
      service.getDownloadUrl("policy-1", actorId, [PERMISSIONS.POLICY_READ]),
    ).resolves.toEqual({ url: "https://signed.example/policy" });

    expect(mocks.requireRegisteredStorageUrl).toHaveBeenCalledWith(fileUrl, {
      allowedBuckets: ["documents"],
      purpose: "company-policy",
    });
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      "documents",
      "policies/handbook.pdf",
      300,
    );
  });

  it("hides a cross-entity policy from direct metadata and download reads", async () => {
    mocks.findById.mockResolvedValue({
      id: "policy-1",
      fileUrl,
      entityId: "entity-2",
      isActive: true,
    });

    await expect(
      service.getById("policy-1", actorId, [PERMISSIONS.POLICY_READ]),
    ).rejects.toThrow("Policy not found");
    await expect(
      service.getDownloadUrl("policy-1", actorId, [PERMISSIONS.POLICY_READ]),
    ).rejects.toThrow("Policy not found");
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("hides an inactive policy from direct metadata and download reads", async () => {
    mocks.findById.mockResolvedValue({
      id: "policy-1",
      fileUrl,
      entityId: "entity-1",
      isActive: false,
    });

    await expect(
      service.getById("policy-1", actorId, [PERMISSIONS.POLICY_READ]),
    ).rejects.toThrow("Policy not found");
    await expect(
      service.getDownloadUrl("policy-1", actorId, [PERMISSIONS.POLICY_READ]),
    ).rejects.toThrow("Policy not found");
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });
});
