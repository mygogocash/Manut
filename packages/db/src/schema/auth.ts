import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * Better Auth tables (hand-written; Better Auth's default model names and
 * camelCase columns, so no `fields` mapping is needed for them). The `users`
 * table is the existing Prisma table, adopted via `user.modelName: "users"` in
 * packages/auth. Better Auth >= 1.7 requires `account.issuer`; credential rows
 * must be `local:credential`.
 */
export const account = pgTable(
  "account",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    issuer: text("issuer").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
