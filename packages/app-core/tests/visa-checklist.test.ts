import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getVisaChecklist,
  toggleVisaChecklistItem,
} from "../src/visa/visa-checklist";

const visaRecordId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const apiItem = {
  id: itemId,
  visaRecordId,
  templateItemId: "tmpl-item-1",
  label: "Passport copy",
  category: "document",
  optional: false,
  completed: false,
  completedAt: null,
  completedById: null,
  sortOrder: 0,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("visa checklist contracts", () => {
  it("lists checklist items for a visa record and strips timestamps", async () => {
    const get = vi.fn().mockResolvedValue({ data: [apiItem] });
    const client = { get } as unknown as ApiClient;

    const result = await getVisaChecklist(client, visaRecordId);
    expect(result).toEqual([
      {
        id: itemId,
        visaRecordId,
        templateItemId: "tmpl-item-1",
        label: "Passport copy",
        category: "document",
        optional: false,
        completed: false,
        completedAt: null,
        completedById: null,
        sortOrder: 0,
      },
    ]);
    expect(result[0]).not.toHaveProperty("createdAt");
    expect(result[0]).not.toHaveProperty("updatedAt");
    expect(get).toHaveBeenCalledWith(
      `/visa-checklist/record/${visaRecordId}`,
      undefined,
    );
  });

  it("returns an empty checklist when no items exist", async () => {
    const get = vi.fn().mockResolvedValue({ data: [] });
    const client = { get } as unknown as ApiClient;

    await expect(getVisaChecklist(client, visaRecordId)).resolves.toEqual([]);
  });

  it("rejects empty visa record ids before calling the API", async () => {
    const get = vi.fn();
    const client = { get } as unknown as ApiClient;

    await expect(getVisaChecklist(client, "")).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });

  it("toggles a checklist item and strips timestamps", async () => {
    const put = vi.fn();
    const post = vi.fn().mockResolvedValue({
      data: {
        ...apiItem,
        completed: true,
        completedAt: "2026-07-19T07:00:00.000Z",
        completedById: "11111111-1111-4111-8111-111111111111",
        updatedAt: "2026-07-19T07:00:00.000Z",
      },
    });
    const client = { post, put } as unknown as ApiClient;

    const result = await toggleVisaChecklistItem(
      client,
      visaRecordId,
      itemId,
      { completed: true },
    );
    expect(result).toEqual({
      id: itemId,
      visaRecordId,
      templateItemId: "tmpl-item-1",
      label: "Passport copy",
      category: "document",
      optional: false,
      completed: true,
      completedAt: "2026-07-19T07:00:00.000Z",
      completedById: "11111111-1111-4111-8111-111111111111",
      sortOrder: 0,
    });
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(post).toHaveBeenCalledWith(
      `/visa-checklist/record/${visaRecordId}/items/${itemId}/toggle`,
      { completed: true },
    );
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects empty ids before toggling", async () => {
    const post = vi.fn();
    const client = { post } as unknown as ApiClient;

    await expect(
      toggleVisaChecklistItem(client, "", itemId, { completed: true }),
    ).rejects.toThrow();
    await expect(
      toggleVisaChecklistItem(client, visaRecordId, "", { completed: true }),
    ).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
});
