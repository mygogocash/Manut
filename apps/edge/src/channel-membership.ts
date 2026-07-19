import {
  assertDistinctApiOrigin,
  configuredApiOrigin,
  PROXY_HOP_HEADER,
} from "./api-proxy";
import { HttpError } from "./http-error";
import { isHyperdriveEnabled } from "./hyperdrive";
import {
  canAccessChannel,
  hasMessagePermission,
  MESSAGES_ADMIN,
  MESSAGES_READ,
} from "./messages/access";
import type { MessagesStore } from "./messages/store";
import type { PresentedCredential, RuntimeBindings } from "./runtime";

/**
 * Ask whether the credential may access the channel before upgrading to a
 * shared Durable Object room. Prefer Hyperdrive+Prisma when the boundary is
 * enabled; otherwise use the authoritative Express membership probe.
 */
export async function assertChannelMembership(options: {
  env: RuntimeBindings;
  channelId: string;
  credential: PresentedCredential;
  /** Incoming Worker request URL — used to reject self-proxy API_ORIGIN. */
  requestUrl?: string;
  /** Test seam — production resolves principal via JWT middleware first. */
  userId?: string;
  createMessagesStore?: (
    env: RuntimeBindings,
  ) => MessagesStore | Promise<MessagesStore>;
}): Promise<void> {
  if (isHyperdriveEnabled(options.env)) {
    const userId = options.userId;
    if (!userId) {
      // Realtime upgrade path always authenticates first and sets principal.
      // Without a subject we cannot authorize from Hyperdrive.
      throw new HttpError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required.",
      );
    }
    const store = options.createMessagesStore
      ? await options.createMessagesStore(options.env)
      : (
          await import("./messages/prisma-store")
        ).createHyperdriveMessagesStore(options.env);
    const permissions = await store.loadPermissions(userId);
    const accessUser = { id: userId, permissions: [...permissions] };
    if (
      !hasMessagePermission(accessUser, MESSAGES_READ) &&
      !hasMessagePermission(accessUser, MESSAGES_ADMIN)
    ) {
      throw new HttpError(
        403,
        "CHANNEL_ACCESS_DENIED",
        "You do not have access to this channel.",
      );
    }
    const channel = await store.findChannelById(options.channelId);
    if (!channel) {
      throw new HttpError(
        403,
        "CHANNEL_ACCESS_DENIED",
        "You do not have access to this channel.",
      );
    }
    if (
      !canAccessChannel(accessUser, {
        id: channel.id,
        type: channel.type,
        members: channel.members,
      })
    ) {
      throw new HttpError(
        403,
        "CHANNEL_ACCESS_DENIED",
        "You do not have access to this channel.",
      );
    }
    return;
  }

  const origin = configuredApiOrigin(options.env.API_ORIGIN);
  if (options.requestUrl) {
    assertDistinctApiOrigin(origin, new URL(options.requestUrl));
  }
  const basePath = origin.pathname.replace(/\/+$/u, "");
  const target = new URL(origin);
  target.pathname = `${basePath}/api/messages/channels/${encodeURIComponent(options.channelId)}`;

  const headers = new Headers({
    accept: "application/json",
    [PROXY_HOP_HEADER]: "1",
  });
  if (options.credential.source === "bearer") {
    headers.set("authorization", `Bearer ${options.credential.token}`);
  } else {
    headers.set("cookie", `manut_access_token=${options.credential.token}`);
  }

  let response: Response;
  try {
    response = await fetch(target.toString(), {
      headers,
      method: "GET",
      redirect: "manual",
    });
  } catch {
    throw new HttpError(
      502,
      "API_UPSTREAM_UNAVAILABLE",
      "The API is temporarily unavailable.",
    );
  }

  if (response.status === 200) {
    return;
  }
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 404
  ) {
    throw new HttpError(
      403,
      "CHANNEL_ACCESS_DENIED",
      "You do not have access to this channel.",
    );
  }
  throw new HttpError(
    502,
    "CHANNEL_MEMBERSHIP_UNAVAILABLE",
    "Channel membership could not be verified.",
  );
}
