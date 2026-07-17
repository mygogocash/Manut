import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { surveyFormsService } from "@/modules/survey-forms/survey-forms.service";

// Only surveyForm is touched by close/reopen. Service deps are mocked so the
// module graph loads in isolation (none are called on these paths).
const db = vi.hoisted(() => ({
  surveyForm: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));
vi.mock("@/modules/wall/wall.service", () => ({
  wallService: { createPost: vi.fn() },
}));
vi.mock("@/modules/news/news.service", () => ({
  newsService: { createNews: vi.fn() },
}));
vi.mock("@/modules/company-dates/company-dates.service", () => ({
  companyDatesService: { create: vi.fn() },
}));

const CREATOR = "user-1";
const OTHER = "user-2";
const MANAGE = [PERMISSIONS.SURVEY_MANAGE_WAVE];

beforeEach(() => {
  vi.clearAllMocks();
  db.surveyForm.update.mockResolvedValue({ id: "f1" });
});

describe("close — creator or survey manager", () => {
  it("creator closes a published form", async () => {
    db.surveyForm.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "published",
    });

    await surveyFormsService.close("f1", CREATOR, []);

    expect(db.surveyForm.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f1" },
        data: { status: "closed", closedAt: expect.any(Date) },
      }),
    );
  });

  it("a survey manager who is NOT the creator can close", async () => {
    db.surveyForm.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "published",
    });

    await surveyFormsService.close("f1", OTHER, MANAGE);

    expect(db.surveyForm.update).toHaveBeenCalledOnce();
  });

  it("a non-creator without the manage permission is forbidden", async () => {
    db.surveyForm.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "published",
    });

    await expect(
      surveyFormsService.close("f1", OTHER, []),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.surveyForm.update).not.toHaveBeenCalled();
  });

  it("rejects closing a form that is not published", async () => {
    db.surveyForm.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "draft",
    });

    await expect(
      surveyFormsService.close("f1", CREATOR, []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s a missing form", async () => {
    db.surveyForm.findUnique.mockResolvedValue(null);
    await expect(
      surveyFormsService.close("nope", CREATOR, MANAGE),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("reopen — closed → published", () => {
  it("a survey manager reopens a closed form and clears closedAt", async () => {
    db.surveyForm.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "closed",
      archivedAt: null,
    });

    await surveyFormsService.reopen("f1", OTHER, MANAGE);

    expect(db.surveyForm.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f1" },
        data: { status: "published", closedAt: null },
      }),
    );
  });

  it("a non-creator without the manage permission is forbidden", async () => {
    db.surveyForm.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "closed",
      archivedAt: null,
    });

    await expect(
      surveyFormsService.reopen("f1", OTHER, []),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.surveyForm.update).not.toHaveBeenCalled();
  });

  it("refuses to reopen an archived form", async () => {
    db.surveyForm.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "closed",
      archivedAt: new Date(),
    });

    await expect(
      surveyFormsService.reopen("f1", CREATOR, MANAGE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses to reopen a form that is not closed", async () => {
    db.surveyForm.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "published",
      archivedAt: null,
    });

    await expect(
      surveyFormsService.reopen("f1", CREATOR, MANAGE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
