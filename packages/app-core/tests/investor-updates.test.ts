import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  investorUpdateSchema,
  listInvestorUpdates,
} from "../src/investor-updates/investor-updates";

const update = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Q2 portfolio update",
  content: "<p>Confidential narrative</p>",
  period: "2026-Q2",
  status: "draft",
  sentAt: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  sender: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
};

describe("investor-updates foundation contracts", () => {
  it("keeps list fields and strips content/sender email", () => {
    const parsed = investorUpdateSchema.parse(update);
    expect(parsed).toEqual({
      id: update.id,
      title: "Q2 portfolio update",
      period: "2026-Q2",
      status: "draft",
      sentAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      sender: { id: update.sender.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("content");
  });

  it("lists investor updates with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [update],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listInvestorUpdates(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ title: "Q2 portfolio update" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/investor-updates?page=1&limit=20", {
      signal,
    });
  });
});
