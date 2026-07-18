import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getSystemSettings,
  systemSettingsSchema,
} from "../src/settings/system-settings";

describe("system settings foundation contracts", () => {
  it("projects key/value map and stringifies nested values", () => {
    const parsed = systemSettingsSchema.parse({
      companyName: "Manut",
      leaveCcEmails: ["hr@example.com", "legal@example.com"],
      featureFlags: { beta: true },
      maxUploadMb: 25,
    });

    expect(parsed).toEqual({
      entries: [
        { key: "companyName", value: "Manut" },
        {
          key: "featureFlags",
          value: JSON.stringify({ beta: true }),
        },
        {
          key: "leaveCcEmails",
          value: JSON.stringify(["hr@example.com", "legal@example.com"]),
        },
        { key: "maxUploadMb", value: "25" },
      ],
    });
  });

  it("omits secret-like keys from the read projection", () => {
    const parsed = systemSettingsSchema.parse({
      companyName: "Manut",
      smtpPassword: "should-not-appear",
      api_key: "also-hidden",
      webhookSecret: "nope",
    });

    expect(parsed.entries.map((entry) => entry.key)).toEqual(["companyName"]);
  });

  it("loads settings via GET /admin/settings", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: { companyName: "Manut", maxUploadMb: 10 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(getSystemSettings(client, signal)).resolves.toEqual({
      entries: [
        { key: "companyName", value: "Manut" },
        { key: "maxUploadMb", value: "10" },
      ],
    });
    expect(get).toHaveBeenCalledWith("/admin/settings", { signal });
  });
});
