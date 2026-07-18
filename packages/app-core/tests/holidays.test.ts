import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listHolidays, publicHolidaySchema } from "../src/holidays/holidays";

const holiday = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  entityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  date: "2026-12-25T00:00:00.000Z",
  name: "Christmas Day",
  notes: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  entity: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Manut", code: "MNT" },
};

describe("holidays contracts", () => {
  it("projects a public holiday date and strips timestamps", () => {
    const parsed = publicHolidaySchema.parse(holiday);
    expect(parsed).toEqual({
      id: holiday.id,
      entityId: holiday.entityId,
      date: "2026-12-25",
      name: "Christmas Day",
      notes: null,
      isActive: true,
      entity: holiday.entity,
    });
    expect(parsed).not.toHaveProperty("createdAt");
  });

  it("lists holidays with year filter", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [holiday],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listHolidays(client, { year: 2026 }, signal),
    ).resolves.toMatchObject({
      data: [{ name: "Christmas Day", date: "2026-12-25" }],
      meta: { total: 1 },
    });
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("year=2026"),
      { signal },
    );
  });
});
