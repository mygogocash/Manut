import { HttpError } from "./http-error";
import type { PresentedCredential, RuntimeBindings } from "./runtime";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function configuredApiOrigin(value: string): URL {
  try {
    const origin = new URL(value.trim());
    const safeProtocol =
      origin.protocol === "https:" ||
      (origin.protocol === "http:" && LOOPBACK_HOSTS.has(origin.hostname));
    if (
      !safeProtocol ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash
    ) {
      throw new Error("Unsafe API origin.");
    }
    return origin;
  } catch {
    throw new HttpError(
      503,
      "API_ORIGIN_NOT_CONFIGURED",
      "The API origin is unavailable.",
    );
  }
}

/**
 * Ask the authoritative Express API whether the credential may access the
 * channel before upgrading to a shared Durable Object room.
 */
export async function assertChannelMembership(options: {
  env: RuntimeBindings;
  channelId: string;
  credential: PresentedCredential;
}): Promise<void> {
  const origin = configuredApiOrigin(options.env.API_ORIGIN);
  const basePath = origin.pathname.replace(/\/+$/u, "");
  const target = new URL(origin);
  target.pathname = `${basePath}/api/messages/channels/${encodeURIComponent(options.channelId)}`;

  const headers = new Headers({
    accept: "application/json",
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
  if (response.status === 401 || response.status === 403 || response.status === 404) {
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
