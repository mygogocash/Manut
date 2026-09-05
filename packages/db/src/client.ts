import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DbClientOptions = {
  /** Upper bound on pooled connections for this request. Hyperdrive pools upstream. */
  max?: number;
};

/**
 * One database handle per request (Workers isolates share nothing).
 * `prepare: false` because Hyperdrive/pgbouncer-style poolers cannot hold
 * prepared statements across connections; `fetch_types: false` skips the
 * pg_type round-trip on every cold connection.
 */
export function createDb(connectionString: string, options: DbClientOptions = {}) {
  const client = postgres(connectionString, {
    max: options.max ?? 5,
    prepare: false,
    fetch_types: false,
  });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Db = ReturnType<typeof createDb>["db"];
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
