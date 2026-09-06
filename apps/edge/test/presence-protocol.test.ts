import { describe, expect, it } from "vitest";
import { applyPresenceEvent, parsePresenceEvent } from "../src/durable-objects/presence-protocol";

describe("presence protocol", () => {
  it("parses join / leave / typing / chat and rejects junk", () => {
    expect(parsePresenceEvent(JSON.stringify({ type: "join", userId: "u1", userName: "Ada" }))).toEqual({
      type: "join",
      userId: "u1",
      userName: "Ada",
    });
    expect(parsePresenceEvent(JSON.stringify({ type: "leave", userId: "u1" }))?.type).toBe("leave");
    expect(parsePresenceEvent(JSON.stringify({ type: "typing", userId: "u1", userName: "Ada" }))?.type).toBe("typing");
    expect(parsePresenceEvent(JSON.stringify({ type: "chat", userId: "u1", userName: "Ada", text: "hi" }))?.type).toBe("chat");
    expect(parsePresenceEvent("{")).toBeNull();
    expect(parsePresenceEvent(JSON.stringify({ type: "join" }))).toBeNull();
  });

  it("applies join and leave to the occupant list", () => {
    const afterJoin = applyPresenceEvent([], { type: "join", userId: "u1", userName: "Ada" });
    expect(afterJoin).toEqual([{ userId: "u1", userName: "Ada" }]);
    expect(applyPresenceEvent(afterJoin, { type: "leave", userId: "u1" })).toEqual([]);
    expect(applyPresenceEvent(afterJoin, { type: "typing", userId: "u1", userName: "Ada" })).toEqual(afterJoin);
  });
});
