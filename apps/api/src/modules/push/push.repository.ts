import { prisma } from "@/infrastructure/database/prisma";
import { USER_AGENT_MAX } from "@/modules/push/push.types";

// Prisma access for push subscriptions.
//
// Everything here is keyed on `userId` or on `endpoint`. There is no method to
// look a subscription up by endpoint *alone* for the purpose of authorising a
// caller — that would let anyone holding an endpoint act on somebody else's
// device. Ownership always comes from the session.

const subscriptionSelect = {
  id: true,
  userId: true,
  endpoint: true,
  p256dh: true,
  auth: true,
  failureCount: true,
} as const;

export class PushRepository {
  /**
   * Creates or refreshes the subscription for a device.
   *
   * Upsert on `endpoint`, because a browser reissues the same endpoint for the
   * same device: subscribing twice must not leave two rows, and re-enabling
   * after a logout must not fail on a unique-constraint violation.
   *
   * `userId` is part of the update, so a shared device that a second person
   * signs into re-points the row at them rather than continuing to deliver the
   * first person's notifications.
   */
  upsert(input: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }) {
    const userAgent = input.userAgent?.slice(0, USER_AGENT_MAX) ?? null;
    return prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent,
      },
      update: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent,
        // A device coming back is not a failing device.
        failureCount: 0,
      },
      select: subscriptionSelect,
    });
  }

  /** Every device for one recipient. The only read path in the send loop. */
  findByUser(userId: string) {
    return prisma.pushSubscription.findMany({
      where: { userId },
      select: subscriptionSelect,
    });
  }

  findByUsers(userIds: string[]) {
    if (userIds.length === 0) return Promise.resolve([]);
    return prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: subscriptionSelect,
    });
  }

  /**
   * Removes one device.
   *
   * Scoped by `userId` as well as endpoint so a caller cannot unsubscribe a
   * device that is not theirs by guessing or replaying an endpoint.
   * `deleteMany` rather than `delete` so a miss is a no-op instead of throwing.
   */
  deleteForUser(userId: string, endpoint: string) {
    return prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /** Every device for a user — used on logout. */
  deleteAllForUser(userId: string) {
    return prisma.pushSubscription.deleteMany({ where: { userId } });
  }

  /**
   * Drops an endpoint the push service has told us is gone.
   *
   * Not scoped by user on purpose: a 404/410 is the protocol saying this
   * endpoint no longer exists for anyone, and it is only ever called with an
   * endpoint the send loop just read from our own table.
   */
  deleteByEndpoint(endpoint: string) {
    return prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  markSuccess(endpoint: string) {
    return prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { failureCount: 0, lastSuccessAt: new Date() },
    });
  }

  incrementFailure(endpoint: string) {
    return prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { failureCount: { increment: 1 } },
    });
  }

  countForUser(userId: string) {
    return prisma.pushSubscription.count({ where: { userId } });
  }
}

export const pushRepository = new PushRepository();
