import { Hono } from "hono";
import type { Bindings } from "../env";

export const health = new Hono<{ Bindings: Bindings }>().get("/", (c) =>
  c.json({ status: "ok", service: "intranet-edge", timestamp: new Date().toISOString() }),
);
