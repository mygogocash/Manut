import { drizzle } from "drizzle-orm/d1";
import * as edgeSchema from "./schema";

/** D1 binding. Structural so `@nexora/db` type-checks in Node without workers-types. */
export function createEdgeDb(d1: object) {
  return drizzle(d1 as Parameters<typeof drizzle>[0], { schema: edgeSchema });
}

export type EdgeDb = ReturnType<typeof createEdgeDb>;
export { edgeSchema };
