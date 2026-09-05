import { describe, expect, it } from "vitest";

import {
  formatSettingValue,
  parseSettingValue,
  settingKind,
  settingLabel,
} from "@/components/settings/setting-value";

/*
 * The System Settings tab used to render every value with `String(value)` into a
 * text input and post back the raw string, so saving turned `true` into `"true"`,
 * `90` into `"90"`, and an object into the literal `"[object Object]"`. The API
 * now checks each key against the type it holds, so preserving types is no longer
 * cosmetic — a flattened value is rejected outright.
 */
describe("settingKind", () => {
  it("picks the control from the value's own type", () => {
    expect(settingKind(true)).toBe("boolean");
    expect(settingKind(false)).toBe("boolean");
    expect(settingKind(90)).toBe("number");
    expect(settingKind(0)).toBe("number");
    expect(settingKind(["pdf", "png"])).toBe("list");
    expect(settingKind("Intranet")).toBe("text");
    expect(settingKind(null)).toBe("text");
  });
});

describe("formatSettingValue", () => {
  it("shows a list as the comma text the field reads back", () => {
    expect(formatSettingValue(["pdf", "png", "jpg"])).toBe("pdf, png, jpg");
  });

  it("shows scalars plainly and null as empty", () => {
    expect(formatSettingValue(90)).toBe("90");
    expect(formatSettingValue(0)).toBe("0");
    expect(formatSettingValue("Intranet")).toBe("Intranet");
    expect(formatSettingValue(null)).toBe("");
  });
});

describe("parseSettingValue", () => {
  it("reads a number back as a number, not a string", () => {
    expect(parseSettingValue("number", "480")).toEqual({
      value: 480,
      error: null,
    });
    expect(parseSettingValue("number", "0")).toEqual({ value: 0, error: null });
  });

  it("accepts a pasted number with separators", () => {
    expect(parseSettingValue("number", "10,080").value).toBe(10_080);
  });

  /*
   * Falling back to zero would save successfully and quietly set a session
   * timeout or a without-approval spend limit to nothing.
   */
  it("refuses an unreadable number rather than coercing it to zero", () => {
    expect(parseSettingValue("number", "abc").error).toMatch(/not a number/);
    expect(parseSettingValue("number", "abc").value).toBeNull();
    expect(parseSettingValue("number", "").error).toMatch(/Enter a number/);
    expect(parseSettingValue("number", "").value).toBeNull();
  });

  it("round-trips a list through the comma text", () => {
    const value = ["pdf", "png", "xlsx"];
    const parsed = parseSettingValue("list", formatSettingValue(value));
    expect(parsed).toEqual({ value, error: null });
  });

  it("tolerates spacing and trailing separators in a list", () => {
    expect(parseSettingValue("list", " pdf , png ,").value).toEqual([
      "pdf",
      "png",
    ]);
  });

  it("keeps text as text", () => {
    expect(parseSettingValue("text", "Asia/Bangkok")).toEqual({
      value: "Asia/Bangkok",
      error: null,
    });
  });

  it("keeps a boolean a boolean", () => {
    expect(parseSettingValue("boolean", "true").value).toBe(true);
    expect(parseSettingValue("boolean", "false").value).toBe(false);
  });
});

describe("settingLabel", () => {
  it("reads a dotted key as a sentence", () => {
    expect(settingLabel("security.session_timeout_minutes")).toBe(
      "Security session timeout minutes",
    );
    expect(settingLabel("app.name")).toBe("App name");
  });
});
