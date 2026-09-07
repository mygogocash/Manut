export type PresenceOccupant = { userId: string; userName: string };

export type PresenceEvent =
  | { type: "join"; userId: string; userName: string }
  | { type: "leave"; userId: string }
  | { type: "typing"; userId: string; userName: string }
  | { type: "chat"; userId: string; userName: string; text: string }
  | { type: "presence"; occupants: PresenceOccupant[] };

export function parsePresenceEvent(raw: string): PresenceEvent | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || !("type" in value)) return null;
    const type = (value as { type: unknown }).type;
    if (type === "join" || type === "typing") {
      const { userId, userName } = value as { userId?: unknown; userName?: unknown };
      if (typeof userId !== "string" || typeof userName !== "string") return null;
      return { type, userId, userName };
    }
    if (type === "leave") {
      const { userId } = value as { userId?: unknown };
      return typeof userId === "string" ? { type, userId } : null;
    }
    if (type === "chat") {
      const { userId, userName, text } = value as { userId?: unknown; userName?: unknown; text?: unknown };
      if (typeof userId !== "string" || typeof userName !== "string" || typeof text !== "string") return null;
      return { type, userId, userName, text };
    }
    if (type === "presence") {
      const { occupants } = value as { occupants?: unknown };
      if (!Array.isArray(occupants)) return null;
      return { type, occupants: occupants.filter(isOccupant) };
    }
    return null;
  } catch {
    return null;
  }
}

function isOccupant(value: unknown): value is PresenceOccupant {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as PresenceOccupant).userId === "string" &&
    typeof (value as PresenceOccupant).userName === "string"
  );
}

export function applyPresenceEvent(occupants: PresenceOccupant[], event: PresenceEvent): PresenceOccupant[] {
  if (event.type === "join") {
    return [...occupants.filter((row) => row.userId !== event.userId), { userId: event.userId, userName: event.userName }];
  }
  if (event.type === "leave") {
    return occupants.filter((row) => row.userId !== event.userId);
  }
  return occupants;
}
