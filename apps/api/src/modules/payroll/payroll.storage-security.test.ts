import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { PayrollService } from "@/modules/payroll/payroll.service";
import { updatePayslipSchema } from "@/modules/payroll/payroll.validation";

const MANAGER_PERMISSIONS = [PERMISSIONS.PAYROLL_CREATE];

const mocks = vi.hoisted(() => ({
  bulkDeletePayslips: vi.fn(),
  createUpload: vi.fn(),
  createSignedUrl: vi.fn(),
  deleteFile: vi.fn(),
  findPayslipById: vi.fn(),
  findPayslipDocumentUrls: vi.fn(),
  findPayslipsForHr: vi.fn(),
  findRunById: vi.fn(),
  loggerWarn: vi.fn(),
  prismaPayslipFindUnique: vi.fn(),
  requireRegisteredStorageUrl: vi.fn(),
  updatePayslip: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock("@/common/utils/logger", () => ({
  logger: { warn: mocks.loggerWarn },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    payslip: {
      findUnique: mocks.prismaPayslipFindUnique,
    },
  },
}));

vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  STORAGE_BUCKETS: { DOCUMENTS: "documents" },
  createSignedUrl: mocks.createSignedUrl,
  deleteFile: mocks.deleteFile,
  requireRegisteredStorageUrl: mocks.requireRegisteredStorageUrl,
  uploadFile: mocks.uploadFile,
}));

vi.mock("@/modules/payroll/payroll.repository", () => ({
  payrollRepository: {
    bulkDeletePayslips: mocks.bulkDeletePayslips,
    findPayslipById: mocks.findPayslipById,
    findPayslipDocumentUrls: mocks.findPayslipDocumentUrls,
    findPayslipsForHr: mocks.findPayslipsForHr,
    findRunById: mocks.findRunById,
    updatePayslip: mocks.updatePayslip,
  },
}));

vi.mock("@/modules/uploads/uploads.repository", () => ({
  uploadsRepository: {
    create: mocks.createUpload,
  },
}));

describe("payroll storage authorization", () => {
  const service = new PayrollService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bulkDeletePayslips.mockResolvedValue({ count: 1 });
    mocks.createUpload.mockResolvedValue({ id: "upload-1" });
    mocks.createSignedUrl.mockResolvedValue("https://signed.example/payslip");
    mocks.deleteFile.mockResolvedValue(undefined);
    mocks.updatePayslip.mockResolvedValue({ id: "payslip-1" });
    mocks.uploadFile.mockResolvedValue({
      bucket: "documents",
      path: "employee-1/payslip.pdf",
      url: "https://manut.supabase.co/storage/v1/object/public/documents/employee-1/payslip.pdf",
    });
  });

  it("rejects documentUrl mutation through the generic payslip editor", () => {
    expect(() =>
      updatePayslipSchema.parse({
        baseSalary: 100,
        documentUrl:
          "https://manut.supabase.co/storage/v1/object/public/documents/legal/evidence.pdf",
      }),
    ).toThrow();
  });

  it.each([
    [
      "the company-wide flat list",
      () =>
        service.listPayslipsForHr({ hasDocument: undefined }, [
          PERMISSIONS.PAYROLL_READ,
        ]),
    ],
    [
      "an arbitrary payslip download",
      () =>
        service.getPayslipDownloadUrlForHr("other-payslip", [
          PERMISSIONS.PAYROLL_READ,
        ]),
    ],
    [
      "an arbitrary single export",
      () =>
        service.exportPayslipDocument("other-payslip", "pdf", [
          PERMISSIONS.PAYROLL_READ,
        ]),
    ],
    [
      "a company-wide bulk export",
      () =>
        service.exportRunPayslipsZip("other-run", "pdf", [
          PERMISSIONS.PAYROLL_READ,
        ]),
    ],
    [
      "an attachment",
      () =>
        service.attachPayslipDocument(
          "other-run",
          "other-payslip",
          "employee-1",
          {
            buffer: Buffer.from("pdf"),
            originalName: "payslip.pdf",
            mimeType: "application/pdf",
            size: 3,
          },
          [PERMISSIONS.PAYROLL_READ],
        ),
    ],
    [
      "a document removal",
      () =>
        service.removePayslipDocument("other-run", "other-payslip", [
          PERMISSIONS.PAYROLL_READ,
        ]),
    ],
    [
      "a bulk delete",
      () =>
        service.bulkDeletePayslips(
          ["other-payslip"],
          [PERMISSIONS.PAYROLL_READ],
        ),
    ],
  ])("denies a payroll:read-only caller access to %s", async (_label, act) => {
    await expect(act()).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    PERMISSIONS.PAYROLL_CREATE,
    PERMISSIONS.PAYROLL_APPROVE,
    PERMISSIONS.PAYROLL_HR_ADMIN,
  ])("allows %s to use the HR flat list", async (managerPermission) => {
    mocks.findPayslipsForHr.mockResolvedValue([]);

    await expect(
      service.listPayslipsForHr({ hasDocument: undefined }, [
        managerPermission,
      ]),
    ).resolves.toEqual([]);
  });

  it("rejects a read-only caller before looking up another employee's download", async () => {
    await expect(
      service.getPayslipDownloadUrlForHr("other-payslip", [
        PERMISSIONS.PAYROLL_READ,
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mocks.findPayslipById).not.toHaveBeenCalled();
  });

  it("rejects a read-only caller before rendering another employee's export", async () => {
    await expect(
      service.exportPayslipDocument("other-payslip", "pdf", [
        PERMISSIONS.PAYROLL_READ,
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mocks.prismaPayslipFindUnique).not.toHaveBeenCalled();
  });

  it("keeps employee downloads scoped to the caller's own payslip", async () => {
    mocks.findPayslipById.mockResolvedValue({
      employeeId: "employee-2",
      documentUrl:
        "https://manut.supabase.co/storage/v1/object/public/documents/payroll/other.pdf",
    });

    await expect(
      service.getMyPayslipDownloadUrl("employee-1", "other-payslip"),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mocks.requireRegisteredStorageUrl).not.toHaveBeenCalled();
  });

  it("keeps employee exports scoped to the caller's own payslip", async () => {
    mocks.prismaPayslipFindUnique.mockResolvedValue({
      employeeId: "employee-2",
    });

    await expect(
      service.exportMyPayslipDocument("employee-1", "other-payslip", "pdf"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("does not delete an object selected by an untrusted persisted URL", async () => {
    mocks.findPayslipDocumentUrls.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        documentUrl:
          "https://attacker.example/storage/v1/object/public/documents/legal/evidence.pdf",
      },
    ]);
    mocks.requireRegisteredStorageUrl.mockRejectedValue(
      new BadRequestException("wrong purpose"),
    );

    await expect(
      service.bulkDeletePayslips(
        ["11111111-1111-4111-8111-111111111111"],
        MANAGER_PERMISSIONS,
      ),
    ).resolves.toEqual({ deletedCount: 1 });

    expect(mocks.requireRegisteredStorageUrl).toHaveBeenCalledWith(
      expect.stringContaining("attacker.example"),
      {
        allowedBuckets: ["documents"],
        linkedId: "11111111-1111-4111-8111-111111111111",
        linkedTo: "payslip",
        purpose: "payslip-document",
      },
    );
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it("deletes only an object registered to the selected payslip", async () => {
    mocks.findPayslipDocumentUrls.mockResolvedValue([
      {
        id: "22222222-2222-4222-8222-222222222222",
        documentUrl:
          "https://manut.supabase.co/storage/v1/object/public/documents/payroll/payslip.pdf",
      },
    ]);
    mocks.requireRegisteredStorageUrl.mockResolvedValue({
      bucket: "documents",
      path: "payroll/payslip.pdf",
      uploadId: "upload-2",
    });

    await service.bulkDeletePayslips(
      ["22222222-2222-4222-8222-222222222222"],
      MANAGER_PERMISSIONS,
    );

    expect(mocks.deleteFile).toHaveBeenCalledWith(
      "documents",
      "payroll/payslip.pdf",
    );
  });

  it("refuses to sign a download URL with the wrong payslip provenance", async () => {
    mocks.findPayslipById.mockResolvedValue({
      employeeId: "employee-1",
      documentUrl:
        "https://manut.supabase.co/storage/v1/object/public/documents/legal/evidence.pdf",
    });
    mocks.requireRegisteredStorageUrl.mockRejectedValue(
      new BadRequestException("wrong purpose"),
    );

    await expect(
      service.getMyPayslipDownloadUrl("employee-1", "payslip-1"),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("binds HR downloads to the exact payslip registry record", async () => {
    const documentUrl =
      "https://manut.supabase.co/storage/v1/object/public/documents/payroll/payslip.pdf";
    mocks.findPayslipById.mockResolvedValue({ documentUrl });
    mocks.requireRegisteredStorageUrl.mockResolvedValue({
      bucket: "documents",
      path: "payroll/payslip.pdf",
      uploadId: "upload-2",
    });

    await expect(
      service.getPayslipDownloadUrlForHr("payslip-2", MANAGER_PERMISSIONS),
    ).resolves.toEqual({ url: "https://signed.example/payslip" });

    expect(mocks.requireRegisteredStorageUrl).toHaveBeenCalledWith(
      documentUrl,
      {
        allowedBuckets: ["documents"],
        linkedId: "payslip-2",
        linkedTo: "payslip",
        purpose: "payslip-document",
      },
    );
  });

  it("registers an uploaded PDF to its exact payslip before persisting it", async () => {
    mocks.findPayslipById.mockResolvedValue({
      id: "payslip-1",
      payrollRunId: "run-1",
    });

    await service.attachPayslipDocument(
      "run-1",
      "payslip-1",
      "actor-1",
      {
        buffer: Buffer.from("pdf"),
        originalName: "July payslip.pdf",
        mimeType: "application/pdf",
        size: 3,
      },
      MANAGER_PERMISSIONS,
    );

    expect(mocks.createUpload).toHaveBeenCalledWith({
      bucket: "documents",
      filename: "July_payslip.pdf",
      linkedId: "payslip-1",
      linkedTo: "payslip",
      mimeType: "application/pdf",
      originalName: "July payslip.pdf",
      path: "employee-1/payslip.pdf",
      purpose: "payslip-document",
      size: 3,
      uploadedBy: "actor-1",
    });
    expect(mocks.updatePayslip).toHaveBeenCalledWith("payslip-1", {
      documentUrl:
        "https://manut.supabase.co/storage/v1/object/public/documents/employee-1/payslip.pdf",
    });
  });

  it("removes the uploaded object if payslip attachment persistence fails", async () => {
    mocks.findPayslipById.mockResolvedValue({
      id: "payslip-1",
      payrollRunId: "run-1",
    });
    mocks.updatePayslip.mockRejectedValue(new Error("write failed"));

    await expect(
      service.attachPayslipDocument(
        "run-1",
        "payslip-1",
        "actor-1",
        {
          buffer: Buffer.from("pdf"),
          originalName: "payslip.pdf",
          mimeType: "application/pdf",
          size: 3,
        },
        MANAGER_PERMISSIONS,
      ),
    ).rejects.toThrow("write failed");

    expect(mocks.deleteFile).toHaveBeenCalledWith(
      "documents",
      "employee-1/payslip.pdf",
    );
  });

  it("removes an uploaded object when its registry row cannot be created", async () => {
    mocks.findPayslipById.mockResolvedValue({
      id: "payslip-1",
      payrollRunId: "run-1",
      documentUrl: null,
    });
    mocks.createUpload.mockRejectedValue(new Error("registry write failed"));

    await expect(
      service.attachPayslipDocument(
        "run-1",
        "payslip-1",
        "actor-1",
        {
          buffer: Buffer.from("pdf"),
          originalName: "payslip.pdf",
          mimeType: "application/pdf",
          size: 3,
        },
        MANAGER_PERMISSIONS,
      ),
    ).rejects.toThrow("registry write failed");

    expect(mocks.updatePayslip).not.toHaveBeenCalled();
    expect(mocks.deleteFile).toHaveBeenCalledWith(
      "documents",
      "employee-1/payslip.pdf",
    );
  });

  it("deletes the previously registered document after replacement persists", async () => {
    const previousUrl =
      "https://manut.supabase.co/storage/v1/object/public/documents/payroll/old.pdf";
    mocks.findPayslipById.mockResolvedValue({
      id: "payslip-1",
      payrollRunId: "run-1",
      documentUrl: previousUrl,
    });
    mocks.requireRegisteredStorageUrl.mockResolvedValue({
      bucket: "documents",
      path: "payroll/old.pdf",
      uploadId: "upload-old",
    });

    await service.attachPayslipDocument(
      "run-1",
      "payslip-1",
      "actor-1",
      {
        buffer: Buffer.from("pdf"),
        originalName: "replacement.pdf",
        mimeType: "application/pdf",
        size: 3,
      },
      MANAGER_PERMISSIONS,
    );

    expect(mocks.requireRegisteredStorageUrl).toHaveBeenCalledWith(
      previousUrl,
      {
        allowedBuckets: ["documents"],
        linkedId: "payslip-1",
        linkedTo: "payslip",
        purpose: "payslip-document",
      },
    );
    expect(mocks.updatePayslip.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requireRegisteredStorageUrl.mock.invocationCallOrder[0]!,
    );
    expect(mocks.deleteFile).toHaveBeenCalledWith(
      "documents",
      "payroll/old.pdf",
    );
  });

  it("does not delete an unproven legacy document during replacement", async () => {
    mocks.findPayslipById.mockResolvedValue({
      id: "payslip-1",
      payrollRunId: "run-1",
      documentUrl: "https://legacy.example/payroll/old.pdf",
    });
    mocks.requireRegisteredStorageUrl.mockRejectedValue(
      new BadRequestException("not registered"),
    );

    await expect(
      service.attachPayslipDocument(
        "run-1",
        "payslip-1",
        "actor-1",
        {
          buffer: Buffer.from("pdf"),
          originalName: "replacement.pdf",
          mimeType: "application/pdf",
          size: 3,
        },
        MANAGER_PERMISSIONS,
      ),
    ).resolves.toEqual({ id: "payslip-1" });

    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it("does not report replacement failure after the new URL persisted", async () => {
    mocks.findPayslipById.mockResolvedValue({
      id: "payslip-1",
      payrollRunId: "run-1",
      documentUrl:
        "https://manut.supabase.co/storage/v1/object/public/documents/payroll/old.pdf",
    });
    mocks.requireRegisteredStorageUrl.mockRejectedValue(
      new Error("registry unavailable"),
    );

    await expect(
      service.attachPayslipDocument(
        "run-1",
        "payslip-1",
        "actor-1",
        {
          buffer: Buffer.from("pdf"),
          originalName: "replacement.pdf",
          mimeType: "application/pdf",
          size: 3,
        },
        MANAGER_PERMISSIONS,
      ),
    ).resolves.toEqual({ id: "payslip-1" });

    expect(mocks.updatePayslip).toHaveBeenCalled();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "payslip document cleanup failed",
      expect.objectContaining({ payslipId: "payslip-1" }),
    );
  });

  it("clears the URL before deleting a removed registered document", async () => {
    const previousUrl =
      "https://manut.supabase.co/storage/v1/object/public/documents/payroll/old.pdf";
    mocks.findPayslipById.mockResolvedValue({
      id: "payslip-1",
      payrollRunId: "run-1",
      documentUrl: previousUrl,
    });
    mocks.requireRegisteredStorageUrl.mockResolvedValue({
      bucket: "documents",
      path: "payroll/old.pdf",
      uploadId: "upload-old",
    });

    await service.removePayslipDocument(
      "run-1",
      "payslip-1",
      MANAGER_PERMISSIONS,
    );

    expect(mocks.updatePayslip).toHaveBeenCalledWith("payslip-1", {
      documentUrl: null,
    });
    expect(mocks.updatePayslip.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requireRegisteredStorageUrl.mock.invocationCallOrder[0]!,
    );
    expect(mocks.deleteFile).toHaveBeenCalledWith(
      "documents",
      "payroll/old.pdf",
    );
  });

  it("does not delete an unproven legacy document during removal", async () => {
    mocks.findPayslipById.mockResolvedValue({
      id: "payslip-1",
      payrollRunId: "run-1",
      documentUrl: "https://legacy.example/payroll/old.pdf",
    });
    mocks.requireRegisteredStorageUrl.mockRejectedValue(
      new BadRequestException("not registered"),
    );

    await expect(
      service.removePayslipDocument("run-1", "payslip-1", MANAGER_PERMISSIONS),
    ).resolves.toEqual({ id: "payslip-1" });

    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it("does not report removal failure after the URL was cleared", async () => {
    mocks.findPayslipById.mockResolvedValue({
      id: "payslip-1",
      payrollRunId: "run-1",
      documentUrl:
        "https://manut.supabase.co/storage/v1/object/public/documents/payroll/old.pdf",
    });
    mocks.requireRegisteredStorageUrl.mockRejectedValue(
      new Error("registry unavailable"),
    );

    await expect(
      service.removePayslipDocument("run-1", "payslip-1", MANAGER_PERMISSIONS),
    ).resolves.toEqual({ id: "payslip-1" });

    expect(mocks.updatePayslip).toHaveBeenCalledWith("payslip-1", {
      documentUrl: null,
    });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "payslip document cleanup failed",
      expect.objectContaining({ payslipId: "payslip-1" }),
    );
  });

  it("does not report bulk-delete failure after rows were deleted", async () => {
    mocks.findPayslipDocumentUrls.mockResolvedValue([
      {
        id: "payslip-1",
        documentUrl:
          "https://manut.supabase.co/storage/v1/object/public/documents/payroll/old.pdf",
      },
    ]);
    mocks.requireRegisteredStorageUrl.mockResolvedValue({
      bucket: "documents",
      path: "payroll/old.pdf",
      uploadId: "upload-old",
    });
    mocks.deleteFile.mockRejectedValue(new Error("cleanup failed"));

    await expect(
      service.bulkDeletePayslips(["payslip-1"], MANAGER_PERMISSIONS),
    ).resolves.toEqual({ deletedCount: 1 });

    expect(mocks.bulkDeletePayslips).toHaveBeenCalledWith(["payslip-1"]);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "payslip document cleanup failed",
      expect.objectContaining({ payslipId: "payslip-1" }),
    );
  });
});
