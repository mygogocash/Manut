import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { DocsService } from "@/modules/docs/docs.service";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    wikiPage: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    wikiPagePermission: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    wikiPageVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const wp = prisma.wikiPage as unknown as {
  findFirst: Mock;
  findMany: Mock;
  findUnique: Mock;
  count: Mock;
  create: Mock;
  update: Mock;
  delete: Mock;
};
const wpp = prisma.wikiPagePermission as unknown as {
  findUnique: Mock;
  findMany: Mock;
  findFirst: Mock;
  upsert: Mock;
  delete: Mock;
};
const wpv = prisma.wikiPageVersion as unknown as {
  findFirst: Mock;
  findMany: Mock;
  create: Mock;
};
const userFindUnique = (prisma.user as unknown as { findUnique: Mock })
  .findUnique;

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

const baseRow = {
  id: "page-1",
  title: "Hello",
  body: "<p>body</p>",
  parentId: null,
  position: 0,
  folder: null,
  slug: null,
  isPublished: true,
  isRestricted: false,
  createdById: ALICE,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: ALICE, name: "Alice", email: "alice@x.io" },
  updatedBy: { id: ALICE, name: "Alice", email: "alice@x.io" },
};

describe("DocsService", () => {
  let service: DocsService;

  beforeEach(() => {
    service = new DocsService();
    vi.clearAllMocks();
  });

  describe("list / tree (page-level filtering)", () => {
    it("hides restricted pages from non-admin users without an explicit grant", async () => {
      const restricted = {
        ...baseRow,
        id: "page-r",
        title: "Secrets",
        isRestricted: true,
        createdById: ALICE,
      };
      wp.findMany.mockResolvedValue([baseRow, restricted]);
      wp.count.mockResolvedValue(2);
      wpp.findMany.mockResolvedValue([]);

      const res = await service.list(
        { page: 1, limit: 50, includeUnpublished: false },
        { id: BOB, isAdmin: false },
      );
      expect(res.data.map((d) => d.id)).toEqual(["page-1"]);
    });

    it("returns restricted pages to admins", async () => {
      const restricted = { ...baseRow, id: "page-r", isRestricted: true };
      wp.findMany.mockResolvedValue([baseRow, restricted]);
      wp.count.mockResolvedValue(2);

      const res = await service.list(
        { page: 1, limit: 50, includeUnpublished: false },
        { id: BOB, isAdmin: true },
      );
      expect(res.data).toHaveLength(2);
      expect(wpp.findMany).not.toHaveBeenCalled();
    });

    it("returns restricted pages the user has been granted", async () => {
      const restricted = {
        ...baseRow,
        id: "page-r",
        isRestricted: true,
        createdById: ALICE,
      };
      wp.findMany.mockResolvedValue([restricted]);
      wp.count.mockResolvedValue(1);
      wpp.findMany.mockResolvedValue([{ pageId: "page-r" }]);

      const res = await service.list(
        { page: 1, limit: 50, includeUnpublished: false },
        { id: BOB, isAdmin: false },
      );
      expect(res.data.map((d) => d.id)).toEqual(["page-r"]);
    });

    it("always returns the creator's own restricted pages", async () => {
      const restricted = {
        ...baseRow,
        id: "page-r",
        isRestricted: true,
        createdById: BOB,
      };
      wp.findMany.mockResolvedValue([restricted]);
      wp.count.mockResolvedValue(1);
      wpp.findMany.mockResolvedValue([]);

      const res = await service.list(
        { page: 1, limit: 50, includeUnpublished: false },
        { id: BOB, isAdmin: false },
      );
      expect(res.data).toHaveLength(1);
    });
  });

  describe("update / versioning", () => {
    it("snapshots the previous body before persisting a body change", async () => {
      wp.findUnique.mockResolvedValueOnce(baseRow);
      wpv.findFirst.mockResolvedValue({ version: 2 });
      wp.update.mockResolvedValue({ ...baseRow, body: "<p>new</p>" });

      await service.update(
        "page-1",
        { body: "<p>new</p>" },
        { id: ALICE, isAdmin: true },
      );

      expect(wpv.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pageId: "page-1",
          version: 3,
          body: baseRow.body,
          title: baseRow.title,
        }),
      });
    });

    it("does not snapshot when only metadata changes", async () => {
      wp.findUnique.mockResolvedValueOnce(baseRow);
      wp.update.mockResolvedValue({ ...baseRow, isPublished: false });

      await service.update(
        "page-1",
        { isPublished: false },
        { id: ALICE, isAdmin: true },
      );

      expect(wpv.create).not.toHaveBeenCalled();
    });

    it("rejects edits to a restricted page when the user lacks an edit grant", async () => {
      const restricted = {
        ...baseRow,
        isRestricted: true,
        createdById: ALICE,
      };
      wp.findUnique.mockResolvedValueOnce(restricted);
      // canAccess re-fetch — same row.
      wp.findUnique.mockResolvedValueOnce({
        isRestricted: true,
        createdById: ALICE,
      });
      wpp.findUnique.mockResolvedValue({ level: "read" });

      await expect(
        service.update(
          "page-1",
          { body: "<p>new</p>" },
          { id: BOB, isAdmin: false },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects making a page its own ancestor", async () => {
      // Trying to set page-1's parent to "y" where y's parent is page-1 —
      // a direct cycle.
      const target = { ...baseRow, id: "page-1", parentId: null };
      wp.findUnique.mockResolvedValueOnce(target); // existing
      wp.findUnique.mockResolvedValueOnce({ id: "y" }); // candidate parent exists
      wp.findUnique.mockResolvedValueOnce({ parentId: "page-1" }); // y's parent is page-1

      await expect(
        service.update(
          "page-1",
          { parentId: "y" },
          { id: ALICE, isAdmin: true },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("restoreVersion", () => {
    it("snapshots current state then writes the target body", async () => {
      const target = {
        id: "v-1",
        pageId: "page-1",
        version: 1,
        title: "Old title",
        body: "<p>old</p>",
      };
      wp.findUnique.mockResolvedValueOnce(baseRow);
      wpv.findFirst
        .mockResolvedValueOnce(target) // findFirst({ id: versionId, pageId })
        .mockResolvedValueOnce({ version: 5 }); // last version for snapshot
      wp.findUnique.mockResolvedValueOnce(baseRow); // existing for snapshot
      wp.update.mockResolvedValue({
        ...baseRow,
        title: "Old title",
        body: "<p>old</p>",
      });

      const out = await service.restoreVersion("page-1", "v-1", {
        id: ALICE,
        isAdmin: true,
      });

      expect(wpv.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ version: 6 }),
      });
      expect(wp.update).toHaveBeenCalledWith({
        where: { id: "page-1" },
        data: expect.objectContaining({
          title: "Old title",
          body: "<p>old</p>",
        }),
        include: expect.any(Object),
      });
      expect(out.title).toBe("Old title");
    });

    it("404s on a missing version", async () => {
      wp.findUnique.mockResolvedValueOnce(baseRow);
      wpv.findFirst.mockResolvedValue(null);
      await expect(
        service.restoreVersion("page-1", "v-x", {
          id: ALICE,
          isAdmin: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("grantPermission", () => {
    it("upserts an existing grant", async () => {
      wp.findUnique.mockResolvedValueOnce(baseRow); // canAccess
      wpp.findUnique.mockResolvedValue(null); // no existing perm
      wp.findUnique.mockResolvedValueOnce({ id: "page-1" }); // page exists
      userFindUnique.mockResolvedValue({ id: BOB });
      wpp.upsert.mockResolvedValue({
        id: "perm-1",
        userId: BOB,
        level: "edit",
        user: { id: BOB, name: "Bob", email: "b@x.io" },
      });

      await service.grantPermission(
        "page-1",
        { userId: BOB, level: "edit" },
        { id: ALICE, isAdmin: true },
      );

      expect(wpp.upsert).toHaveBeenCalledWith({
        where: { pageId_userId: { pageId: "page-1", userId: BOB } },
        create: { pageId: "page-1", userId: BOB, level: "edit" },
        update: { level: "edit" },
        include: expect.any(Object),
      });
    });
  });
});
