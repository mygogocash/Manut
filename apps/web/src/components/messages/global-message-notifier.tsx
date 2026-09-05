"use client";

import { Hash, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  type ChannelEvent,
  getMessagesRealtimeSocket,
  type MessagesRealtimeSocket,
} from "@/components/messages/message-stream";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/providers/auth-provider";
import { type Channel, getChannels } from "@/services/message.service";

/**
 * Mounted once at the dashboard layout. Surfaces a toast (and optional
 * browser Notification) whenever a `message.created` socket event fires
 * for any conversation the current user can see, while:
 *
 *  - the message is NOT authored by the current user, AND
 *  - the user is NOT currently viewing /messages (those views already
 *    update inline + clear the unread badge on read).
 *
 * The same socket connection backs the in-page chat view; opening the
 * channel still works because socket.io multiplexes a single connection.
 */
export function GlobalMessageNotifier() {
  const { user, hasAnyPermission, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const isOnMessages = pathname?.startsWith("/messages") ?? false;
  const isOnMessagesRef = useRef(isOnMessages);
  const canUseMessaging = hasAnyPermission("messages:read");

  // Cache the channel directory so a `message.created` event can resolve
  // to a friendly label ("Sarah in #general" vs "Direct message from
  // Sarah") without an HTTP round-trip per event. Kept fresh via
  // channel.* socket events below.
  const channelMapRef = useRef<Map<string, Channel>>(new Map());

  useEffect(() => {
    isOnMessagesRef.current = isOnMessages;
  }, [isOnMessages]);

  // Best-effort: ask once for permission so desktop notifications can
  // fire later. Browsers may silently deny; we fall back to in-app toast.
  useEffect(() => {
    if (!isAuthenticated || !canUseMessaging) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [isAuthenticated, canUseMessaging]);

  useEffect(() => {
    if (!isAuthenticated || !canUseMessaging) return;
    let cancelled = false;
    void getChannels()
      .then((res) => {
        if (cancelled) return;
        const m = new Map<string, Channel>();
        for (const c of res.data) m.set(c.id, c);
        channelMapRef.current = m;
      })
      .catch(() => {
        /* best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, canUseMessaging]);

  useEffect(() => {
    if (!isAuthenticated || !canUseMessaging || !user?.id) return;
    const socket: MessagesRealtimeSocket = getMessagesRealtimeSocket();

    const handle = (event: unknown) => {
      const ev = event as ChannelEvent;

      // Keep the channel cache fresh so labels for new DMs / channels
      // resolve correctly without a hard reload.
      if (ev.type === "channel.created" || ev.type === "channel.updated") {
        channelMapRef.current.set(ev.payload.id, ev.payload);
        return;
      }
      if (ev.type === "channel.deleted") {
        channelMapRef.current.delete(ev.payload.id);
        return;
      }
      if (ev.type !== "message.created") return;
      if (ev.payload.authorId === user.id) return;
      // Don't double-notify when the user is already on the messages
      // surface — the inline list + per-channel pill already handle it.
      if (isOnMessagesRef.current) return;

      const author = ev.payload.author?.name ?? "Someone";
      const avatarUrl = ev.payload.author?.avatarUrl ?? null;
      const initials = author
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const channel = channelMapRef.current.get(ev.channelId);
      const isDm = channel?.type === "dm";
      const channelLabel = isDm
        ? "Direct message"
        : channel?.name
          ? `#${channel.name}`
          : "New message";

      const body = ev.payload.content?.trim() ?? "";
      const preview = body
        ? body.length > 140
          ? `${body.slice(0, 140)}…`
          : body
        : "(attachment)";

      // Nudge the sidebar to re-fetch its badge immediately — the
      // default 30 s poll is too slow for "I just got a message" UX.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("intranet:unread-bump"));
      }

      toast(
        <div className="flex items-start gap-2.5">
          <Avatar className="size-8 shrink-0">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={author} /> : null}
            <AvatarFallback className="text-[11px] font-semibold">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div
              className={`
                text-foreground flex items-center gap-1.5 text-sm font-medium
              `}
            >
              <span className="truncate">{author}</span>
              <span
                className={`
                  text-muted-foreground inline-flex items-center gap-0.5
                  text-[11px] font-normal
                `}
              >
                {isDm ? (
                  <User className="size-3" />
                ) : (
                  <Hash className="size-3" />
                )}
                {channelLabel}
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {preview}
            </p>
          </div>
        </div>,
        {
          icon: null,
          action: {
            label: "Open",
            onClick: () => {
              if (typeof window !== "undefined") {
                window.location.assign("/messages");
              }
            },
          },
        },
      );

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          // `renotify` is supported by Chrome but not in TS lib types
          // we currently target; cast to bypass while keeping the
          // option set on capable browsers.
          const title = isDm ? author : `${author} · ${channelLabel}`;
          const n = new Notification(title, {
            body: preview,
            tag: `msg-${ev.channelId}`,
            silent: false,
            icon: avatarUrl ?? undefined,
            ...({ renotify: true } as Record<string, unknown>),
          } as NotificationOptions);
          n.onclick = () => {
            window.focus();
            window.location.assign("/messages");
            n.close();
          };
        } catch {
          // Some platforms throw on icons / actions; the toast already
          // surfaced the event so swallow this and move on.
        }
      }
    };

    socket.on("messages:event", handle as never);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off("messages:event", handle as never);
    };
  }, [isAuthenticated, canUseMessaging, user?.id]);

  return null;
}
