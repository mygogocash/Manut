import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listVisaChecklistTemplates,
  visaChecklistTemplateSchema,
} from "../src/visa/visa-checklist-templates";

const template = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  visaType: "non_immigrant_b",
  country: "TH",
  name: "Standard B checklist",
  items: [
    {
      id: "item-1",
      label: "Passport copy",
      category: "document",
      optional: false,
      sortOrder: 0,
    },
  ],
  isActive: true,
  entityId: "entity-1",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("visa checklist template contracts", () => {
  it("projects template summary and strips item labels", () => {
    const parsed = visaChecklistTemplateSchema.parse(template);
    expect(parsed).toEqual({
      id: template.id,
      visaType: "non_immigrant_b",
      country: "TH",
      name: "Standard B checklist",
      itemCount: 1,
      isActive: true,
    });
    expect(parsed).not.toHaveProperty("items");
    expect(parsed).not.toHaveProperty("entityId");
  });

  it("lists templates", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [template] });
    const client = { get } as unknown as ApiClient;

    await expect(
      listVisaChecklistTemplates(client, signal),
    ).resolves.toEqual([
      expect.objectContaining({ name: "Standard B checklist", itemCount: 1 }),
    ]);
    expect(get).toHaveBeenCalledWith("/visa-checklist/templates", { signal });
  });
});
