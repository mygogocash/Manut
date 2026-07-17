import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { companyDatesService } from "@/modules/company-dates/company-dates.service";
import { newsService } from "@/modules/news/news.service";
import { surveyFormsService } from "@/modules/survey-forms/survey-forms.service";
import { wallService } from "@/modules/wall/wall.service";

// `vi.hoisted` lets the mock object exist before `vi.mock` is hoisted, so we
// keep a typed handle (every method is a Mock) without fighting PrismaClient's
// real types. Only the models the announce path touches are stubbed.
const db = vi.hoisted(() => ({
  surveyForm: { findUnique: vi.fn() },
  systemSetting: { findUnique: vi.fn() },
  wallPost: { updateMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  companyNews: { updateMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  companyDate: { updateMany: vi.fn(), count: vi.fn(), update: vi.fn() },
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

const createPost = wallService.createPost as Mock;
const createNews = newsService.createNews as Mock;
const createDate = companyDatesService.create as Mock;

const FORM_ID = "form-1";
const CREATOR = "user-1";
const TITLE = "Go the Extra Mile Award";
const RESPOND_LINK = `/survey-forms/${FORM_ID}/respond`;
const PERMS = [
  PERMISSIONS.WALL_CREATE,
  PERMISSIONS.NEWS_CREATE,
  PERMISSIONS.ADMIN_MANAGE,
];
const ANNOUNCE = {
  wall: true,
  news: true,
  companyDate: true,
  deadline: "2026-06-18",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Published form owned by the actor → announce proceeds.
  db.surveyForm.findUnique.mockResolvedValue({
    id: FORM_ID,
    title: TITLE,
    createdById: CREATOR,
    status: "published",
  });
  // No SystemSetting row → getAnnouncementDefaults uses code defaults.
  db.systemSetting.findUnique.mockResolvedValue(null);
  createPost.mockResolvedValue({ id: "wall-1" });
  createNews.mockResolvedValue({ id: "news-1" });
  createDate.mockResolvedValue({ id: "date-1" });
});

describe("announceNow — idempotent repair-or-create", () => {
  it("creates fresh cards when none exist, linking each to the respond page", async () => {
    for (const m of [db.wallPost, db.companyNews, db.companyDate]) {
      m.updateMany.mockResolvedValue({ count: 0 });
      m.count.mockResolvedValue(0);
      m.update.mockResolvedValue({});
    }

    const res = await surveyFormsService.announceNow(
      FORM_ID,
      CREATOR,
      PERMS,
      ANNOUNCE,
    );

    expect(createPost).toHaveBeenCalledOnce();
    expect(createNews).toHaveBeenCalledOnce();
    expect(createDate).toHaveBeenCalledOnce();
    expect(db.wallPost.update).toHaveBeenCalledWith({
      where: { id: "wall-1" },
      data: { linkUrl: RESPOND_LINK },
    });
    expect(db.companyNews.update).toHaveBeenCalledWith({
      where: { id: "news-1" },
      data: { linkUrl: RESPOND_LINK },
    });
    expect(res.posted).toEqual([
      "Company Wall",
      "Company News",
      "Company Dates",
    ]);
  });

  it("repairs legacy null-link cards in place instead of duplicating", async () => {
    // A pre-deep-link card exists on each surface (updateMany matches it).
    for (const m of [db.wallPost, db.companyNews, db.companyDate]) {
      m.updateMany.mockResolvedValue({ count: 1 });
      m.count.mockResolvedValue(0);
    }

    const res = await surveyFormsService.announceNow(
      FORM_ID,
      CREATOR,
      PERMS,
      ANNOUNCE,
    );

    // No new cards — existing ones backfilled in place.
    expect(createPost).not.toHaveBeenCalled();
    expect(createNews).not.toHaveBeenCalled();
    expect(createDate).not.toHaveBeenCalled();
    // Wall matches by survey type + title-in-body; news/date by exact title.
    expect(db.wallPost.updateMany).toHaveBeenCalledWith({
      where: { type: "survey", linkUrl: null, content: { contains: TITLE } },
      data: { linkUrl: RESPOND_LINK },
    });
    expect(db.companyNews.updateMany).toHaveBeenCalledWith({
      where: { title: `New survey: ${TITLE}`, linkUrl: null },
      data: { linkUrl: RESPOND_LINK },
    });
    expect(db.companyDate.updateMany).toHaveBeenCalledWith({
      where: { title: `Survey closes: ${TITLE}`, linkUrl: null },
      data: { linkUrl: RESPOND_LINK },
    });
    expect(res.posted).toEqual([
      "Company Wall",
      "Company News",
      "Company Dates",
    ]);
  });

  it("is a no-op when a card is already linked (no duplicate, no create)", async () => {
    for (const m of [db.wallPost, db.companyNews, db.companyDate]) {
      m.updateMany.mockResolvedValue({ count: 0 }); // nothing stale to repair
      m.count.mockResolvedValue(1); // already linked to this form
    }

    await surveyFormsService.announceNow(FORM_ID, CREATOR, PERMS, ANNOUNCE);

    expect(createPost).not.toHaveBeenCalled();
    expect(createNews).not.toHaveBeenCalled();
    expect(createDate).not.toHaveBeenCalled();
    expect(db.wallPost.update).not.toHaveBeenCalled();
  });
});
