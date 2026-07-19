import { describe, expect, it } from "vitest";

import {
  IdentityHttpError,
  requireIdentityDb,
  resolveIdentityDbMode,
} from "../src/fail-closed";
import type { IdentityBindings } from "../src/runtime";

describe("identity fail-closed > resolveIdentityDbMode", () => {
  it("given missing IDENTITY_DB binding > then fail_closed", () => {
    const env: IdentityBindings = {};
    expect(resolveIdentityDbMode(env)).toBe("fail_closed");
  });

  it("given IDENTITY_DB present > then ready", () => {
    const env: IdentityBindings = {
      IDENTITY_DB: {} as D1Database,
    };
    expect(resolveIdentityDbMode(env)).toBe("ready");
  });
});

describe("identity fail-closed > requireIdentityDb", () => {
  it("given missing binding > then throws IDENTITY_D1_NOT_PROVISIONED", () => {
    expect(() => requireIdentityDb({})).toThrow(IdentityHttpError);
    try {
      requireIdentityDb({});
    } catch (error) {
      expect(error).toBeInstanceOf(IdentityHttpError);
      expect((error as IdentityHttpError).code).toBe(
        "IDENTITY_D1_NOT_PROVISIONED",
      );
      expect((error as IdentityHttpError).status).toBe(503);
    }
  });
});
