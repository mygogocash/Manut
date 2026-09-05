import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInvestorSchema } from "@/modules/investors/investors.validation";

/**
 * `investorsService.create` maps its input to the repository by ENUMERATING
 * every field. That is a silent-drop hazard: a field can be added to
 * `createInvestorSchema`, pass validation, and never be written — with no
 * type error, because Prisma's create input has almost everything optional.
 *
 * That is not hypothetical. `tags` shipped in exactly that state: the import
 * accepted 5 rows tagged "seed-checks", returned `{created: 5}`, and wrote
 * `tags: []` on all of them. Nothing failed. It was only caught by querying
 * the tag filter afterwards and getting nothing back.
 *
 * So this test does not check one field — it checks the INVARIANT: every key
 * the schema accepts must reach the repository. The next field someone adds
 * is covered before they write a line.
 */

const repo = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/modules/investors/investors.repository", () => ({
  investorsRepository: repo,
  buildInvestorWhere: vi.fn(() => ({})),
}));

vi.mock("@/modules/fundraising-entities/fundraising-entities.service", () => ({
  resolveFundraisingEntityKey: vi.fn(async (k?: string) => k ?? "tbh"),
}));

/** A value that satisfies each schema key, so nothing is dropped for being empty. */
const FULL_INPUT = {
  name: "East Ventures",
  type: "venture_capital",
  status: "lead",
  visibility: "team" as const,
  contactName: "Willson Cuaca",
  contactEmail: "a@b.com",
  contactPhone: "+65 1234 5678",
  website: "https://east.vc",
  location: "Singapore",
  notes: { seeded: "yes" },
  title: "Managing Partner",
  linkedinUrl: "https://sg.linkedin.com/in/wllsn",
  revenueStream: "n/a",
  lastContactDate: "2026-08-26",
  nextAction: "Intro call",
  actInvestment: "25000",
  estInvestment: "100000",
  crossSell: "no",
  region: "SEA",
  notesText: "Priority A+",
  fundraisingEntity: "tbl",
  tags: ["seed-checks"],
};

describe("service.create forwards every field the schema accepts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.create.mockResolvedValue({ id: "inv1" });
  });

  it("has a fixture covering every key in createInvestorSchema", () => {
    // Guards the guard: if someone adds a schema field and does not extend
    // FULL_INPUT, the invariant test below would pass vacuously for it.
    const schemaKeys = Object.keys(createInvestorSchema.shape).sort();
    expect(Object.keys(FULL_INPUT).sort()).toEqual(schemaKeys);
  });

  it("passes a value for every schema key through to the repository", async () => {
    const { investorsService } =
      await import("@/modules/investors/investors.service");

    await investorsService.create("user-1", FULL_INPUT);

    expect(repo.create).toHaveBeenCalledTimes(1);
    const written = repo.create.mock.calls[0]?.[0] as Record<string, unknown>;

    // `visibility` is the one key the mapping may legitimately leave
    // undefined (the column has a default), so it is checked for presence
    // rather than for a value.
    const dropped = Object.keys(createInvestorSchema.shape).filter(
      (key) => !(key in written),
    );
    expect(
      dropped,
      `createInvestorSchema accepts these but create() never writes them: ${dropped.join(", ")}`,
    ).toEqual([]);
  });

  it("writes tags as the array it was given", async () => {
    const { investorsService } =
      await import("@/modules/investors/investors.service");

    await investorsService.create("user-1", FULL_INPUT);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["seed-checks"] }),
    );
  });

  it("defaults tags to an empty array when omitted", async () => {
    const { investorsService } =
      await import("@/modules/investors/investors.service");
    const { tags: _tags, ...withoutTags } = FULL_INPUT;

    await investorsService.create("user-1", withoutTags);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [] }),
    );
  });
});
