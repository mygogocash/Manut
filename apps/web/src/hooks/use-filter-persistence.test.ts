import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseAccounts,
  parseRange,
  parseStoredRange,
  persistAccounts,
  persistRange,
  readPersistedAccounts,
  readPersistedRange,
} from "@/hooks/use-filter-persistence";

/** The global test setup replaces localStorage with spies that store nothing. */
/** Per-method so the mock helpers (mockReturnValue) are visible to the types. */
const store = () => ({
  getItem: vi.mocked(window.localStorage.getItem),
  setItem: vi.mocked(window.localStorage.setItem),
  removeItem: vi.mocked(window.localStorage.removeItem),
});
const setUrl = (search: string) =>
  window.history.replaceState(
    null,
    "",
    `/marketing-analytics/dau-mau${search}`,
  );

beforeEach(() => {
  setUrl("");
  // The global setup's afterEach uses clearAllMocks, which clears recorded calls
  // but KEEPS a mockReturnValue — so a stored value from one test would
  // otherwise still be "remembered" by the next.
  store().getItem.mockReturnValue(null);
});

describe("parseRange", () => {
  it("takes a well-formed pair", () => {
    expect(parseRange("2026-08-01", "2026-08-31")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  // The query string is hand-editable, so a typo stops here rather than at a
  // 400 from the API.
  it("drops one malformed side and keeps the other", () => {
    expect(parseRange("2026-08-01", "lol")).toEqual({
      from: "2026-08-01",
      to: "",
    });
    expect(parseRange("nope", "2026-08-31")).toEqual({
      from: "",
      to: "2026-08-31",
    });
  });

  it("returns nothing when neither side is usable", () => {
    expect(parseRange(null, null)).toBeNull();
    expect(parseRange("", "")).toBeNull();
    expect(parseRange("2026-8-1", "31/08/2026")).toBeNull();
  });

  // A backwards range yields an empty dataset with no visible cause.
  it("refuses a backwards range as a pair", () => {
    expect(parseRange("2026-08-31", "2026-08-01")).toBeNull();
  });

  it("allows a single-day range", () => {
    expect(parseRange("2026-08-18", "2026-08-18")).toEqual({
      from: "2026-08-18",
      to: "2026-08-18",
    });
  });
});

describe("parseStoredRange", () => {
  it("reads what persistRange writes", () => {
    expect(
      parseStoredRange(
        JSON.stringify({ from: "2026-08-01", to: "2026-08-31" }),
      ),
    ).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("treats junk as nothing remembered rather than throwing", () => {
    expect(parseStoredRange(null)).toBeNull();
    expect(parseStoredRange("not json")).toBeNull();
    expect(parseStoredRange("[]")).toBeNull();
    expect(parseStoredRange('"a string"')).toBeNull();
    expect(parseStoredRange(JSON.stringify({ from: 20260801 }))).toBeNull();
  });
});

describe("parseAccounts", () => {
  it("splits a comma-separated list", () => {
    expect(parseAccounts("gopay,dialog")).toEqual(["gopay", "dialog"]);
  });

  it("tolerates whitespace and trailing separators", () => {
    expect(parseAccounts(" gopay , dialog ,")).toEqual(["gopay", "dialog"]);
  });

  // The API rejects an explicitly empty selection, so an emptied param has to
  // land on the default instead of a 400.
  it("reads an empty value as every account", () => {
    expect(parseAccounts(null)).toBeNull();
    expect(parseAccounts("")).toBeNull();
    expect(parseAccounts(" , , ")).toBeNull();
  });
});

describe("readPersistedRange", () => {
  it("prefers the URL — it is what a shared link carries", () => {
    store().getItem.mockReturnValue(
      JSON.stringify({ from: "2026-01-01", to: "2026-01-31" }),
    );
    setUrl("?from=2026-08-01&to=2026-08-31");
    expect(readPersistedRange("dau-mau.range")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("falls back to storage when the URL says nothing", () => {
    store().getItem.mockReturnValue(
      JSON.stringify({ from: "2026-01-01", to: "2026-01-31" }),
    );
    expect(readPersistedRange("dau-mau.range")).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("returns nothing when neither remembers anything", () => {
    expect(readPersistedRange("dau-mau.range")).toBeNull();
  });
});

describe("persistRange", () => {
  it("writes both the URL and storage", () => {
    persistRange("dau-mau.range", { from: "2026-08-01", to: "2026-08-31" });
    expect(store().setItem).toHaveBeenCalledWith(
      "dau-mau.range",
      JSON.stringify({ from: "2026-08-01", to: "2026-08-31" }),
    );
    expect(window.location.search).toContain("from=2026-08-01");
    expect(window.location.search).toContain("to=2026-08-31");
  });

  // A default persists as absence, so Reset genuinely resets instead of being
  // undone next visit by a stored value saying what the default already says.
  it("clears both when the range is empty", () => {
    setUrl("?from=2026-08-01&to=2026-08-31&tab=dashboard");
    persistRange("dau-mau.range", { from: "", to: "" });
    expect(store().removeItem).toHaveBeenCalledWith("dau-mau.range");
    expect(window.location.search).not.toContain("from=");
    expect(window.location.search).not.toContain("to=");
    // Someone else's params are left alone.
    expect(window.location.search).toContain("tab=dashboard");
  });

  it("keeps a half-open range", () => {
    persistRange("dau-mau.range", { from: "2026-08-01", to: "" });
    expect(window.location.search).toContain("from=2026-08-01");
    expect(window.location.search).not.toContain("to=");
  });
});

describe("accounts persistence", () => {
  it("round-trips a narrowed selection through the URL", () => {
    persistAccounts("dau-mau.accounts", ["gopay", "dialog"]);
    expect(store().setItem).toHaveBeenCalledWith(
      "dau-mau.accounts",
      "gopay,dialog",
    );
    expect(readPersistedAccounts("dau-mau.accounts")).toEqual([
      "gopay",
      "dialog",
    ]);
  });

  it("stores every-account as absence, since that is the default anyway", () => {
    setUrl("?accounts=gopay");
    persistAccounts("dau-mau.accounts", null);
    expect(store().removeItem).toHaveBeenCalledWith("dau-mau.accounts");
    expect(window.location.search).not.toContain("accounts=");
  });

  it("treats an empty list the same as every account", () => {
    persistAccounts("dau-mau.accounts", []);
    expect(store().removeItem).toHaveBeenCalledWith("dau-mau.accounts");
  });

  it("prefers the URL over storage", () => {
    store().getItem.mockReturnValue("okara");
    setUrl("?accounts=gopay,dialog");
    expect(readPersistedAccounts("dau-mau.accounts")).toEqual([
      "gopay",
      "dialog",
    ]);
  });
});
