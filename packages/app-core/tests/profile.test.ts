import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getMyProfile,
  myProfileResponseSchema,
  updateMyProfile,
  updateMyProfileInputSchema,
} from "../src/profile/profile";

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@manut.example",
  name: "Person",
  avatarUrl: null,
  isActive: true,
  mustChangePassword: false,
  phone: null,
  phonePublic: false,
  department: "Operations",
  jobTitle: "Coordinator",
  employeeId: "MNT-001",
  employmentType: "full_time",
  startDate: null,
  endDate: null,
  location: null,
  country: null,
  timezone: "Asia/Bangkok",
  entity: { id: "entity-1", name: "Manut", code: "MNT" },
  roles: [{ id: "role-1", name: "Employee" }],
};

describe("profile contracts", () => {
  it("accepts the public profile envelope and rejects extra entity fields", () => {
    expect(
      myProfileResponseSchema.safeParse({ data: { profile } }).success,
    ).toBe(true);
    expect(
      myProfileResponseSchema.safeParse({
        data: {
          profile: {
            ...profile,
            entity: { ...profile.entity, taxId: "must-not-cross-boundary" },
          },
        },
      }).success,
    ).toBe(false);
  });

  it("trims editable text while preserving empty strings for clearing", () => {
    expect(
      updateMyProfileInputSchema.parse({
        phone: "  +66 80 000 0000  ",
        phonePublic: true,
        location: "   ",
        country: " Thailand ",
        timezone: " Asia/Bangkok ",
      }),
    ).toEqual({
      phone: "+66 80 000 0000",
      phonePublic: true,
      location: "",
      country: "Thailand",
      timezone: "Asia/Bangkok",
    });
  });

  it("uses the authenticated profile endpoints and parses their envelopes", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: { profile } });
    const patch = vi.fn().mockResolvedValue({
      data: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: null,
        phone: "+66 80 000 0000",
        phonePublic: true,
        location: null,
        country: "Thailand",
        timezone: "Asia/Bangkok",
      },
    });
    const client = { get, patch } as unknown as ApiClient;

    await expect(getMyProfile(client, signal)).resolves.toEqual(profile);
    await expect(
      updateMyProfile(client, {
        phone: " +66 80 000 0000 ",
        phonePublic: true,
      }),
    ).resolves.toMatchObject({ phonePublic: true });

    expect(get).toHaveBeenCalledWith("/auth/me/profile", { signal });
    expect(patch).toHaveBeenCalledWith("/auth/me/profile", {
      phone: "+66 80 000 0000",
      phonePublic: true,
    });
  });
});
