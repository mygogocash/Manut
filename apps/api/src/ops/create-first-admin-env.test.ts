import { describe, expect, it } from "vitest";

import {
  BootstrapEnvironmentError,
  FIRST_ADMIN_EMAIL,
  loadCreateFirstAdminEnvironment,
} from "../../../../scripts/create-first-admin-env";

const COMPLETE_ENV: NodeJS.ProcessEnv = {
  SUPABASE_URL: "https://manut-owned.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role-not-a-credential",
  DATABASE_URL:
    "postgresql://postgres.manut:placeholder@db.example:5432/postgres",
};

describe("loadCreateFirstAdminEnvironment > refusal path", () => {
  it("given an empty environment > then refuses with BOOTSTRAP_ENV_REFUSED and lists every required name", () => {
    expect(() => loadCreateFirstAdminEnvironment({})).toThrow(
      BootstrapEnvironmentError,
    );

    try {
      loadCreateFirstAdminEnvironment({});
    } catch (error) {
      expect(error).toBeInstanceOf(BootstrapEnvironmentError);
      const refused = error as BootstrapEnvironmentError;
      expect(refused.code).toBe("BOOTSTRAP_ENV_REFUSED");
      expect(refused.message).toContain("Refusing to create the first admin");
      expect(refused.message).toContain(
        "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)",
      );
      expect(refused.message).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(refused.message).toContain("DATABASE_URL");
      expect(refused.message).toContain("Never commit");
    }
  });

  it("given only DATABASE_URL > then refuses and still names the missing SUPABASE_* vars", () => {
    expect(() =>
      loadCreateFirstAdminEnvironment({
        DATABASE_URL: COMPLETE_ENV.DATABASE_URL,
      }),
    ).toThrow(/SUPABASE_URL/);

    try {
      loadCreateFirstAdminEnvironment({
        DATABASE_URL: COMPLETE_ENV.DATABASE_URL,
      });
    } catch (error) {
      const refused = error as BootstrapEnvironmentError;
      expect(refused.message).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(refused.message).not.toMatch(/^\s*- DATABASE_URL$/m);
    }
  });

  it("given blank SUPABASE_* and DATABASE_URL values > then refuses as missing", () => {
    expect(() =>
      loadCreateFirstAdminEnvironment({
        SUPABASE_URL: "   ",
        SUPABASE_SERVICE_ROLE_KEY: "",
        DATABASE_URL: "\t",
      }),
    ).toThrow(BootstrapEnvironmentError);
  });

  it("given a non-https SUPABASE_URL > then refuses", () => {
    expect(() =>
      loadCreateFirstAdminEnvironment({
        ...COMPLETE_ENV,
        SUPABASE_URL: "http://manut-owned.supabase.co",
      }),
    ).toThrow(/must use https:/);
  });

  it("given a non-postgres DATABASE_URL > then refuses", () => {
    expect(() =>
      loadCreateFirstAdminEnvironment({
        ...COMPLETE_ENV,
        DATABASE_URL: "https://example.com/not-postgres",
      }),
    ).toThrow(/PostgreSQL protocol/);
  });
});

describe("loadCreateFirstAdminEnvironment > accept path shape", () => {
  it("given SUPABASE_* + DATABASE_URL > then returns normalized values without embedding secrets in the email constant", () => {
    const loaded = loadCreateFirstAdminEnvironment(COMPLETE_ENV);
    expect(FIRST_ADMIN_EMAIL).toBe("admin@manut.xyz");
    expect(loaded.supabaseUrl).toBe("https://manut-owned.supabase.co");
    expect(loaded.databaseUrl).toBe(COMPLETE_ENV.DATABASE_URL);
    expect(loaded.supabaseServiceRoleKey).toBe(
      COMPLETE_ENV.SUPABASE_SERVICE_ROLE_KEY,
    );
  });

  it("given NEXT_PUBLIC_SUPABASE_URL instead of SUPABASE_URL > then accepts the public URL alias", () => {
    const loaded = loadCreateFirstAdminEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "https://alias.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: COMPLETE_ENV.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: COMPLETE_ENV.DATABASE_URL,
    });
    expect(loaded.supabaseUrl).toBe("https://alias.supabase.co");
  });
});
