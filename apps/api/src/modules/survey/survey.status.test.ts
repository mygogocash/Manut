import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { surveyService } from "@/modules/survey/survey.service";

// Only survey is touched by close/reopen. Service deps are mocked so the
// module graph loads in isolation (none are called on these paths).
const db = vi.hoisted(() => ({
  survey: { findUnique: vi.fn(), update: vi.fn() },
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
const MANAGE = [PERMISSIONS.SURVEY_MANAGE];

beforeEach(() => {
  vi.clearAllMocks();
  db.survey.update.mockResolvedValue({ id: "f1" });
});

describe("close — creator or survey manager", () => {
  it("creator closes a published form", async () => {
    db.survey.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "published",
    });

    await surveyService.close("f1", CREATOR, []);

    expect(db.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f1" },
        data: { status: "closed", closedAt: expect.any(Date) },
      }),
    );
  });

  it("a survey manager who is NOT the creator can close", async () => {
    db.survey.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "published",
    });

    await surveyService.close("f1", OTHER, MANAGE);

    expect(db.survey.update).toHaveBeenCalledOnce();
  });

  it("a non-creator without the manage permission is forbidden", async () => {
    db.survey.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "published",
    });

    await expect(surveyService.close("f1", OTHER, [])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.survey.update).not.toHaveBeenCalled();
  });

  it("rejects closing a form that is not published", async () => {
    db.survey.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "draft",
    });

    await expect(surveyService.close("f1", CREATOR, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("404s a missing form", async () => {
    db.survey.findUnique.mockResolvedValue(null);
    await expect(
      surveyService.close("nope", CREATOR, MANAGE),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("reopen — closed → published", () => {
  it("a survey manager reopens a closed form and clears closedAt", async () => {
    db.survey.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "closed",
      archivedAt: null,
    });

    await surveyService.reopen("f1", OTHER, MANAGE);

    expect(db.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f1" },
        data: { status: "published", closedAt: null },
      }),
    );
  });

  it("a non-creator without the manage permission is forbidden", async () => {
    db.survey.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "closed",
      archivedAt: null,
    });

    await expect(surveyService.reopen("f1", OTHER, [])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.survey.update).not.toHaveBeenCalled();
  });

  it("refuses to reopen an archived form", async () => {
    db.survey.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "closed",
      archivedAt: new Date(),
    });

    await expect(
      surveyService.reopen("f1", CREATOR, MANAGE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses to reopen a form that is not closed", async () => {
    db.survey.findUnique.mockResolvedValue({
      id: "f1",
      createdById: CREATOR,
      status: "published",
      archivedAt: null,
    });

    await expect(
      surveyService.reopen("f1", CREATOR, MANAGE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
