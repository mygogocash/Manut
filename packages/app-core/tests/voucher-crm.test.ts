import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listVoucherEntries,
  voucherEntrySchema,
} from "../src/voucher-crm/voucher-crm";

const entry = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  partner: "Acme Retail",
  country: "TH",
  redeemed: 10,
  issued: 20,
  refund: 1,
  sortOrder: 0,
  notes: "Internal reconciliation note",
  creator: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
};

describe("voucher-crm foundation contracts", () => {
  it("keeps list fields and strips creator email/notes", () => {
    const parsed = voucherEntrySchema.parse(entry);
    expect(parsed).toEqual({
      id: entry.id,
      partner: "Acme Retail",
      country: "TH",
      redeemed: 10,
      issued: 20,
      refund: 1,
      sortOrder: 0,
      creator: { id: entry.creator.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("notes");
    expect(parsed.creator).not.toHaveProperty("email");
  });

  it("lists voucher entries with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [entry],
      totals: { redeemed: 10, issued: 20, refund: 1 },
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listVoucherEntries(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ partner: "Acme Retail" })],
      totals: { redeemed: 10, issued: 20, refund: 1 },
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/voucher-crm?page=1&limit=20", {
      signal,
    });
  });
});
