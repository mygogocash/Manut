import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { hrmsRepository } from "@/modules/hrms/hrms.repository";
import { HrmsService } from "@/modules/hrms/hrms.service";
import {
  createEsopGrantSchema,
  updateEsopGrantSchema,
} from "@/modules/hrms/hrms.validation";
import { mockArgument } from "@/test-utils/assertions";

vi.mock("./hrms.repository", () => ({
  hrmsRepository: {
    getEsopPoolSummary: vi.fn(),
    findGrants: vi.fn(),
    findGrantById: vi.fn(),
    createGrant: vi.fn(),
    updateGrant: vi.fn(),
    deleteGrant: vi.fn(),
    findOnboardingRuns: vi.fn(),
    findOnboardingById: vi.fn(),
    findOnboardingByIdIncludingDeleted: vi.fn(),
    softDeleteOnboarding: vi.fn(),
    restoreOnboarding: vi.fn(),
    createOnboarding: vi.fn(),
    updateOnboarding: vi.fn(),
    createAgreement: vi.fn(),
    updateAgreement: vi.fn(),
    findAgreementById: vi.fn(),
    findOffboardingById: vi.fn(),
    findOffboardingByIdIncludingDeleted: vi.fn(),
    softDeleteOffboarding: vi.fn(),
    restoreOffboarding: vi.fn(),
  },
}));

vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  STORAGE_BUCKETS: { DOCUMENTS: "documents" },
  createSignedUrl: vi.fn(),
  requireRegisteredStorageUrl: vi.fn(),
}));

const baseInput = {
  employeeId: "11111111-1111-4111-8111-111111111111",
  grantDate: "2026-05-01",
  grantType: "equity" as const,
  valueType: "shares" as const,
  shares: 1000,
  vestingMonths: 48,
  cliffMonths: 12,
  lockMonths: 0,
  strikePrice: 0,
  allocationMode: "one_time" as const,
  status: "vesting" as const,
};

describe("hrms.validation — ESOP grant schema", () => {
  it("requires shares > 0 when valueType is shares", () => {
    const result = createEsopGrantSchema.safeParse({
      ...baseInput,
      shares: 0,
    });
    expect(result.success).toBe(false);
  });

  it("requires currency + amount when valueType is currency", () => {
    const result = createEsopGrantSchema.safeParse({
      ...baseInput,
      valueType: "currency",
      shares: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a currency grant with code and amount", () => {
    const result = createEsopGrantSchema.safeParse({
      ...baseInput,
      valueType: "currency",
      shares: 0,
      currencyCode: "THB",
      currencyAmount: 197000,
    });
    expect(result.success).toBe(true);
  });

  it("createEsopGrantSchema > given omitted status > then defaults to vesting", () => {
    const { status: _status, ...input } = baseInput;

    const result = createEsopGrantSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("vesting");
    }
  });

  it("createEsopGrantSchema > given removed status values > then rejects them", () => {
    expect(
      createEsopGrantSchema.safeParse({ ...baseInput, status: "active" })
        .success,
    ).toBe(false);
    expect(
      createEsopGrantSchema.safeParse({ ...baseInput, status: "exercised" })
        .success,
    ).toBe(false);
  });

  it("requires percentOfBase > 0 when valueType is percent", () => {
    const result = createEsopGrantSchema.safeParse({
      ...baseInput,
      valueType: "percent",
      shares: 0,
    });
    expect(result.success).toBe(false);
  });

  it("requires start + end month for monthly_recurring", () => {
    const result = createEsopGrantSchema.safeParse({
      ...baseInput,
      allocationMode: "monthly_recurring",
    });
    expect(result.success).toBe(false);
  });

  it("rejects end month before start month", () => {
    const result = createEsopGrantSchema.safeParse({
      ...baseInput,
      allocationMode: "monthly_recurring",
      allocationStartMonth: "2026-06-01",
      allocationEndMonth: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("update schema accepts a partial currency-mode change", () => {
    const result = updateEsopGrantSchema.safeParse({
      valueType: "currency",
      currencyCode: "USD",
      currencyAmount: 4000,
    });
    expect(result.success).toBe(true);
  });
});

describe("HrmsService.createGrant", () => {
  let svc: HrmsService;

  beforeEach(() => {
    svc = new HrmsService();
    vi.clearAllMocks();
    (hrmsRepository.createGrant as Mock).mockResolvedValue({ id: "g1" });
  });

  it("forwards a one-time share grant to the repository", async () => {
    await svc.createGrant({
      ...baseInput,
      shares: 5000,
    });

    expect(hrmsRepository.createGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: baseInput.employeeId,
        grantType: "equity",
        valueType: "shares",
        shares: 5000,
        allocationMode: "one_time",
        currencyCode: undefined,
        currencyAmount: undefined,
        percentOfBase: undefined,
      }),
    );
  });

  it("passes through currency + monthly recurring fields", async () => {
    await svc.createGrant({
      ...baseInput,
      valueType: "currency",
      shares: 0,
      currencyCode: "THB",
      currencyAmount: 197000,
      allocationMode: "monthly_recurring",
      monthlyAmount: 197000,
      allocationStartMonth: "2024-06-01",
      allocationEndMonth: "2024-12-01",
      source: "Employment contract 2024",
    });

    expect(hrmsRepository.createGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        valueType: "currency",
        currencyCode: "THB",
        currencyAmount: 197000,
        allocationMode: "monthly_recurring",
        monthlyAmount: 197000,
        source: "Employment contract 2024",
      }),
    );
    const call = mockArgument(
      (hrmsRepository.createGrant as Mock).mock.calls,
      0,
      0,
    );
    expect(call.allocationStartMonth).toBeInstanceOf(Date);
    expect(call.allocationEndMonth).toBeInstanceOf(Date);
  });
});

describe("HrmsService — onboarding/offboarding soft delete + restore", () => {
  const svc = new HrmsService();
  const findOnb = hrmsRepository.findOnboardingById as Mock;
  const findOnbInclDeleted =
    hrmsRepository.findOnboardingByIdIncludingDeleted as Mock;
  const softDelOnb = hrmsRepository.softDeleteOnboarding as Mock;
  const restoreOnb = hrmsRepository.restoreOnboarding as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft-deletes an existing onboarding run", async () => {
    findOnb.mockResolvedValue({ id: "run-1" });
    await svc.deleteOnboarding("run-1");
    expect(softDelOnb).toHaveBeenCalledWith("run-1");
  });

  it("throws NotFound when deleting a missing/already-deleted run", async () => {
    findOnb.mockResolvedValue(null);
    await expect(svc.deleteOnboarding("nope")).rejects.toThrow(
      "Onboarding run not found",
    );
    expect(softDelOnb).not.toHaveBeenCalled();
  });

  it("restore uses the include-deleted lookup, not the default finder", async () => {
    // The default finder filters deleted rows out — restore MUST use the
    // include-deleted path or it always 404s (the soft-delete IDOR trap).
    findOnbInclDeleted.mockResolvedValue({
      id: "run-1",
      deletedAt: new Date(),
    });
    await svc.restoreOnboarding("run-1");
    expect(findOnbInclDeleted).toHaveBeenCalledWith("run-1");
    expect(findOnb).not.toHaveBeenCalled();
    expect(restoreOnb).toHaveBeenCalledWith("run-1");
  });

  it("throws NotFound when restoring a truly-missing run", async () => {
    findOnbInclDeleted.mockResolvedValue(null);
    await expect(svc.restoreOnboarding("nope")).rejects.toThrow(
      "Onboarding run not found",
    );
    expect(restoreOnb).not.toHaveBeenCalled();
  });

  it("soft-deletes + restores offboarding symmetrically", async () => {
    (hrmsRepository.findOffboardingById as Mock).mockResolvedValue({
      id: "off-1",
    });
    await svc.deleteOffboarding("off-1");
    expect(hrmsRepository.softDeleteOffboarding).toHaveBeenCalledWith("off-1");

    (
      hrmsRepository.findOffboardingByIdIncludingDeleted as Mock
    ).mockResolvedValue({ id: "off-1", deletedAt: new Date() });
    await svc.restoreOffboarding("off-1");
    expect(hrmsRepository.restoreOffboarding).toHaveBeenCalledWith("off-1");
  });
});

describe("HrmsService agreement storage provenance", () => {
  const svc = new HrmsService();
  const employeeId = "11111111-1111-4111-8111-111111111111";
  const actorId = "22222222-2222-4222-8222-222222222222";
  const fileUrl =
    "https://manut.supabase.co/storage/v1/object/public/documents/agreements/contract.pdf";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an owned employee-linked upload before creating an agreement", async () => {
    const { requireRegisteredStorageUrl } =
      await import("@/infrastructure/storage/supabase-storage");
    (requireRegisteredStorageUrl as Mock).mockResolvedValue({
      bucket: "documents",
      path: "agreements/contract.pdf",
      uploadId: "upload-1",
    });
    (hrmsRepository.createAgreement as Mock).mockResolvedValue({
      id: "agreement-1",
    });

    await svc.createAgreement(
      {
        employeeId,
        type: "employment_contract",
        title: "Employment contract",
        fileUrl,
        fileName: "contract.pdf",
      },
      actorId,
    );

    expect(requireRegisteredStorageUrl).toHaveBeenCalledWith(fileUrl, {
      allowedBuckets: ["documents"],
      purpose: "employee-agreement",
      uploadedBy: actorId,
      linkedTo: "employee",
      linkedId: employeeId,
    });
    expect(hrmsRepository.createAgreement).toHaveBeenCalled();
  });

  it("revalidates employee linkage before signing a download URL", async () => {
    const { createSignedUrl, requireRegisteredStorageUrl } =
      await import("@/infrastructure/storage/supabase-storage");
    (hrmsRepository.findAgreementById as Mock).mockResolvedValue({
      id: "agreement-1",
      employeeId,
      fileUrl,
    });
    (requireRegisteredStorageUrl as Mock).mockResolvedValue({
      bucket: "documents",
      path: "agreements/contract.pdf",
      uploadId: "upload-1",
    });
    (createSignedUrl as Mock).mockResolvedValue("https://signed.example/file");

    await expect(
      svc.getAgreementDownloadUrl("agreement-1", employeeId, []),
    ).resolves.toEqual({ url: "https://signed.example/file" });

    expect(requireRegisteredStorageUrl).toHaveBeenCalledWith(fileUrl, {
      allowedBuckets: ["documents"],
      purpose: "employee-agreement",
      linkedTo: "employee",
      linkedId: employeeId,
    });
  });
});
