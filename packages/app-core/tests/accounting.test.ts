import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listChartOfAccounts } from "../src/accounting/accounting";

const account = {
  id: "claccount00000000000000001",
  entityId: "clentity00000000000000001",
  code: "1000",
  name: "Cash",
  nameTh: "เงินสด",
  type: "asset",
  parentId: null,
  balance: "12500.50",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  deletedAt: null,
  entity: {
    id: "clentity00000000000000001",
    name: "Manut Ops",
    currency: "THB",
  },
  parent: null,
};

describe("accounting foundation contracts", () => {
  it("lists projected chart-of-accounts rows and strips lifecycle and currency fields", async () => {
    const get = vi.fn().mockResolvedValue({ data: [account] });
    const client = { get } as unknown as ApiClient;

    const result = await listChartOfAccounts(client, { type: "asset" });
    expect(result.data[0]).toEqual({
      id: account.id,
      code: "1000",
      name: "Cash",
      nameTh: "เงินสด",
      type: "asset",
      isActive: true,
      balance: "12500.50",
      entity: { id: account.entity.id, name: "Manut Ops" },
      parent: null,
    });
    expect(result.data[0]).not.toHaveProperty("entityId");
    expect(result.data[0]).not.toHaveProperty("createdAt");
    expect(result.data[0]).not.toHaveProperty("deletedAt");
    expect(result.data[0].entity).not.toHaveProperty("currency");
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/accounting/accounts?"),
      undefined,
    );
  });

  it("forwards optional type and entity filters", async () => {
    const get = vi.fn().mockResolvedValue({ data: [] });
    const client = { get } as unknown as ApiClient;

    await listChartOfAccounts(client, {
      entityId: "clentity00000000000000001",
      type: "expense",
      sortBy: "code",
      sortOrder: "asc",
    });
    expect(get).toHaveBeenCalledWith(
      "/accounting/accounts?entityId=clentity00000000000000001&type=expense&sortBy=code&sortOrder=asc",
      undefined,
    );
  });

  it("projects parent account refs when present", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          ...account,
          id: "claccount00000000000000002",
          code: "1100",
          name: "Petty Cash",
          parentId: account.id,
          parent: { id: account.id, code: "1000", name: "Cash" },
        },
      ],
    });
    const client = { get } as unknown as ApiClient;

    const result = await listChartOfAccounts(client);
    expect(result.data[0]?.parent).toEqual({
      id: account.id,
      code: "1000",
      name: "Cash",
    });
  });
});
