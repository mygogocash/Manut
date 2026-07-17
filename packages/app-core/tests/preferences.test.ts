import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCAL_PREFERENCES,
  mergeLocalPreferences,
  parseLocalPreferences,
} from "../src/settings/preferences";

describe("local preferences contracts", () => {
  it("defaults missing preference fields", () => {
    expect(parseLocalPreferences({})).toEqual(DEFAULT_LOCAL_PREFERENCES);
    expect(parseLocalPreferences({ theme: "dark" }).theme).toBe("dark");
  });

  it("rejects unknown theme values and falls back", () => {
    expect(parseLocalPreferences({ theme: "neon" })).toEqual(
      DEFAULT_LOCAL_PREFERENCES,
    );
  });

  it("merges preference patches without dropping defaults", () => {
    expect(
      mergeLocalPreferences(DEFAULT_LOCAL_PREFERENCES, {
        emailNotifications: false,
      }),
    ).toEqual({
      ...DEFAULT_LOCAL_PREFERENCES,
      emailNotifications: false,
    });
  });
});
