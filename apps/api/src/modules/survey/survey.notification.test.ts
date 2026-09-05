import { beforeEach, describe, expect, it, vi } from "vitest";

import { surveyService } from "@/modules/survey/survey.service";

// Only the SystemSetting model is touched by the notification-recipients path.
const db = vi.hoisted(() => ({
  systemSetting: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

const KEY = "survey.form.notification_recipients";

beforeEach(() => {
  vi.clearAllMocks();
  db.systemSetting.upsert.mockResolvedValue({});
});

describe("survey notification recipients", () => {
  it("returns an empty list when no row is stored", async () => {
    db.systemSetting.findUnique.mockResolvedValue(null);
    const res = await surveyService.getNotificationRecipients();
    expect(res).toEqual({ recipients: [] });
    expect(db.systemSetting.findUnique).toHaveBeenCalledWith({
      where: { key: KEY },
    });
  });

  it("normalizes on read: lowercase, trim, dedupe, drop non-strings", async () => {
    db.systemSetting.findUnique.mockResolvedValue({
      value: {
        recipients: [
          "  HR@thebinaryholdings.com ",
          "hr@thebinaryholdings.com",
          "Ops@thebinaryholdings.com",
          42,
          "",
        ],
      },
    });
    const res = await surveyService.getNotificationRecipients();
    expect(res.recipients).toEqual([
      "hr@thebinaryholdings.com",
      "ops@thebinaryholdings.com",
    ]);
  });

  it("persists a normalized recipient list on save", async () => {
    const res = await surveyService.setNotificationRecipients({
      recipients: ["A@x.com", "a@x.com", " B@x.com "],
    });
    expect(res.recipients).toEqual(["a@x.com", "b@x.com"]);
    expect(db.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: KEY },
      update: { value: { recipients: ["a@x.com", "b@x.com"] } },
      create: { key: KEY, value: { recipients: ["a@x.com", "b@x.com"] } },
    });
  });
});
