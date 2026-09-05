import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import {
  __resetPushConfigForTests,
  isSafeNotificationUrl,
  pushService,
} from "@/modules/push/push.service";

// Web Push delivery.
//
// The three properties worth protecting, in order of how much damage a
// regression would do:
//
//   1. A caller cannot address somebody else's device.
//   2. A payload cannot carry a URL that sends the user off-origin.
//   3. A dead subscription is removed rather than retried forever.
//
// `web-push` itself is mocked — this suite is about our policy, not about
// whether a third-party library can sign a VAPID header.

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(() => ({ count: 1 })),
      updateMany: vi.fn(() => ({ count: 1 })),
      count: vi.fn(() => 0),
    },
  },
}));

type M = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  pushSubscription: {
    upsert: M;
    findMany: M;
    deleteMany: M;
    updateMany: M;
    count: M;
  };
};

const USER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const sub = (endpoint: string, failureCount = 0) => ({
  id: `s-${endpoint}`,
  userId: USER,
  endpoint,
  p256dh: "key",
  auth: "auth",
  failureCount,
});

/** A push-service rejection, shaped the way `web-push` throws. */
function pushError(statusCode: number) {
  return Object.assign(new Error(`push failed ${statusCode}`), { statusCode });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetPushConfigForTests();
  process.env.VAPID_PUBLIC_KEY = "test-public";
  process.env.VAPID_PRIVATE_KEY = "test-private";
  process.env.VAPID_SUBJECT = "mailto:it@thebinaryholdings.com";
  db.pushSubscription.upsert.mockResolvedValue({ id: "sub-1" });
  db.pushSubscription.findMany.mockResolvedValue([]);
  db.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
  db.pushSubscription.updateMany.mockResolvedValue({ count: 1 });
  sendNotification.mockResolvedValue(undefined);
});

/* ── Configuration ─────────────────────────────────────────────────── */

describe("configuration", () => {
  it("reports disabled and sends nothing when VAPID keys are absent", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    __resetPushConfigForTests();

    expect(pushService.isEnabled()).toBe(false);
    const report = await pushService.sendToUsers([USER], {
      title: "t",
      body: "b",
      url: "/dashboard",
    });

    // Progressive enhancement: no keys means no push, not a broken intranet.
    expect(report.skipped).toBe(true);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("refuses to register a device when push is not configured", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    __resetPushConfigForTests();

    await expect(
      pushService.subscribe(USER, {
        endpoint: "https://push.example.com/a",
        keys: { p256dh: "k", auth: "a" },
      }),
    ).rejects.toThrow(/not configured/i);
  });

  it("never exposes the private key through the public one", () => {
    expect(pushService.getPublicKey()).toBe("test-public");
    expect(JSON.stringify(pushService.getPublicKey())).not.toContain(
      "test-private",
    );
  });
});

/* ── Subscription lifecycle ────────────────────────────────────────── */

describe("subscription lifecycle", () => {
  it("upserts on endpoint, so re-subscribing a device does not duplicate it", async () => {
    await pushService.subscribe(USER, {
      endpoint: "https://push.example.com/a",
      keys: { p256dh: "k", auth: "a" },
    });

    const args = db.pushSubscription.upsert.mock.calls[0]![0];
    expect(args.where).toEqual({ endpoint: "https://push.example.com/a" });
    // Re-subscribing clears a stale failure count — a device coming back is
    // not a failing device.
    expect(args.update.failureCount).toBe(0);
  });

  it("re-points a shared device at whoever is now signed in", async () => {
    await pushService.subscribe(OTHER, {
      endpoint: "https://push.example.com/a",
      keys: { p256dh: "k", auth: "a" },
    });
    expect(db.pushSubscription.upsert.mock.calls[0]![0].update.userId).toBe(
      OTHER,
    );
  });

  it("truncates the user agent rather than storing it whole", async () => {
    await pushService.subscribe(USER, {
      endpoint: "https://push.example.com/a",
      keys: { p256dh: "k", auth: "a" },
      userAgent: "x".repeat(1000),
    });
    const created = db.pushSubscription.upsert.mock.calls[0]![0].create;
    expect(created.userAgent.length).toBeLessThanOrEqual(255);
  });

  it("scopes unsubscribe to the caller, so an endpoint cannot be replayed", async () => {
    await pushService.unsubscribe(USER, "https://push.example.com/a");
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER, endpoint: "https://push.example.com/a" },
    });
  });

  it("clears every device on logout", async () => {
    db.pushSubscription.deleteMany.mockResolvedValue({ count: 3 });
    const result = await pushService.unsubscribeAll(USER);
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER },
    });
    expect(result.removed).toBe(3);
  });
});

/* ── Multiple devices ──────────────────────────────────────────────── */

describe("multiple devices", () => {
  it("delivers to every device a recipient has", async () => {
    db.pushSubscription.findMany.mockResolvedValue([
      sub("https://push.example.com/desktop"),
      sub("https://push.example.com/android"),
      sub("https://push.example.com/ios"),
    ]);

    const report = await pushService.sendToUsers([USER], {
      title: "Approval required",
      body: "You have an item requiring your attention.",
      url: "/projects",
    });

    expect(sendNotification).toHaveBeenCalledTimes(3);
    expect(report.sent).toBe(3);
  });

  it("de-duplicates repeated recipients before querying", async () => {
    await pushService.sendToUsers([USER, USER, OTHER], {
      title: "t",
      body: "b",
      url: "/dashboard",
    });
    const where = db.pushSubscription.findMany.mock.calls[0]![0].where;
    expect(where.userId.in).toEqual([USER, OTHER]);
  });

  it("reports skipped when a recipient has no devices at all", async () => {
    db.pushSubscription.findMany.mockResolvedValue([]);
    const report = await pushService.sendToUsers([USER], {
      title: "t",
      body: "b",
      url: "/dashboard",
    });
    // Distinct from "tried and failed" — nothing was attempted.
    expect(report.skipped).toBe(true);
    expect(report.failed).toBe(0);
  });
});

/* ── Failure handling ──────────────────────────────────────────────── */

describe("delivery failures", () => {
  it.each([404, 410])(
    "deletes a subscription the push service reports gone (%i)",
    async (code) => {
      db.pushSubscription.findMany.mockResolvedValue([
        sub("https://push.example.com/dead"),
      ]);
      sendNotification.mockRejectedValue(pushError(code));

      const report = await pushService.sendToUsers([USER], {
        title: "t",
        body: "b",
        url: "/dashboard",
      });

      expect(report.expired).toBe(1);
      expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: "https://push.example.com/dead" },
      });
    },
  );

  it("keeps a subscription through a transient failure", async () => {
    db.pushSubscription.findMany.mockResolvedValue([
      sub("https://push.example.com/flaky", 0),
    ]);
    sendNotification.mockRejectedValue(pushError(503));

    const report = await pushService.sendToUsers([USER], {
      title: "t",
      body: "b",
      url: "/dashboard",
    });

    expect(report.failed).toBe(1);
    // Counted, not deleted — a push service having a bad afternoon must not
    // cost users their subscriptions.
    expect(db.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example.com/flaky" },
      data: { failureCount: { increment: 1 } },
    });
    expect(db.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it("drops a subscription once transient failures stop being transient", async () => {
    // 9 previous failures + this one hits the cap of 10.
    db.pushSubscription.findMany.mockResolvedValue([
      sub("https://push.example.com/gone", 9),
    ]);
    sendNotification.mockRejectedValue(pushError(500));

    await pushService.sendToUsers([USER], {
      title: "t",
      body: "b",
      url: "/dashboard",
    });

    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example.com/gone" },
    });
  });

  it("resets the failure count after a success", async () => {
    db.pushSubscription.findMany.mockResolvedValue([
      sub("https://push.example.com/ok", 4),
    ]);

    await pushService.sendToUsers([USER], {
      title: "t",
      body: "b",
      url: "/dashboard",
    });

    expect(db.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example.com/ok" },
      data: { failureCount: 0, lastSuccessAt: expect.any(Date) },
    });
  });

  it("never lets a delivery failure escape to the caller", async () => {
    db.pushSubscription.findMany.mockResolvedValue([
      sub("https://push.example.com/a"),
    ]);
    sendNotification.mockRejectedValue(new Error("network exploded"));

    // The business event must not fail because a push did.
    await expect(
      pushService.sendToUsers([USER], {
        title: "t",
        body: "b",
        url: "/dashboard",
      }),
    ).resolves.toMatchObject({ failed: 1 });
  });
});

/* ── Payload safety ────────────────────────────────────────────────── */

describe("notification target safety", () => {
  it.each(["/dashboard", "/projects?view=pending", "/leave/42#tab"])(
    "accepts the same-origin path %s",
    (url) => {
      expect(isSafeNotificationUrl(url)).toBe(true);
    },
  );

  it.each([
    "https://evil.example.com",
    "//evil.example.com",
    "http://intranet.example.com/dashboard",
    "javascript:alert(1)",
    "/\\evil.example.com",
    "dashboard",
  ])("rejects %s", (url) => {
    expect(isSafeNotificationUrl(url)).toBe(false);
  });

  it("refuses to send at all rather than rewriting an unsafe target", async () => {
    db.pushSubscription.findMany.mockResolvedValue([
      sub("https://push.example.com/a"),
    ]);

    const report = await pushService.sendToUsers([USER], {
      title: "t",
      body: "b",
      url: "https://evil.example.com/steal",
    });

    // Quietly correcting a bad URL would hide the bug that produced it.
    expect(sendNotification).not.toHaveBeenCalled();
    expect(report.skipped).toBe(true);
  });
});

describe("payload contents", () => {
  it("sends exactly what it was given, and nothing more", async () => {
    db.pushSubscription.findMany.mockResolvedValue([
      sub("https://push.example.com/a"),
    ]);

    await pushService.sendToUsers([USER], {
      title: "Approval required",
      body: "You have an item requiring your attention.",
      url: "/projects/abc",
      notificationId: "n-1",
    });

    const body = JSON.parse(sendNotification.mock.calls[0]![1] as string);
    expect(body).toEqual({
      title: "Approval required",
      body: "You have an item requiring your attention.",
      url: "/projects/abc",
      notificationId: "n-1",
    });
    // The subscription's own keys must never be echoed back into a payload.
    const serialised = sendNotification.mock.calls[0]![1] as string;
    expect(serialised).not.toContain("p256dh");
    expect(serialised).not.toContain("test-private");
  });
});
