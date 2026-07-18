import { describe, expect, it, vi } from "vitest";

import {
  hyperdriveConnectionString,
  isHyperdriveEnabled,
  requireHyperdrive,
} from "../src/hyperdrive";
import { createEdgeApp } from "../src/index";
import type { RuntimeBindings } from "../src/runtime";

const TEST_TOKEN = "test-token-that-is-long-enough-for-edge-auth";

function testEnv(overrides: Partial<RuntimeBindings> = {}): RuntimeBindings {
  return {
    API_ORIGIN: "https://api.example",
    API_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    ENABLE_HYPERDRIVE_BOUNDARY: "false",
    ...overrides,
  } as RuntimeBindings;
}

const verifyToken = vi.fn(async () => ({ role: "admin", subject: "user-123" }));

describe("hyperdrive boundary", () => {
  it("is disabled until the boundary flag and binding are both present", () => {
    expect(isHyperdriveEnabled(testEnv())).toBe(false);
    expect(
      isHyperdriveEnabled(
        testEnv({
          ENABLE_HYPERDRIVE_BOUNDARY: "true",
        }),
      ),
    ).toBe(false);
    expect(
      isHyperdriveEnabled(
        testEnv({
          ENABLE_HYPERDRIVE_BOUNDARY: "true",
          HYPERDRIVE_DATABASE: {
            connectionString: "postgresql://edge:local@127.0.0.1:5432/manut",
          } as Hyperdrive,
        }),
      ),
    ).toBe(true);
  });

  it("fails closed when Hyperdrive is required without a provisioned binding", () => {
    expect(() =>
      requireHyperdrive(
        testEnv({
          ENABLE_HYPERDRIVE_BOUNDARY: "true",
        }),
      ),
    ).toThrow(/HYPERDRIVE_NOT_PROVISIONED|Database capability is disabled/i);

    expect(() =>
      hyperdriveConnectionString(
        testEnv({
          ENABLE_HYPERDRIVE_BOUNDARY: "false",
          HYPERDRIVE_DATABASE: {
            connectionString: "postgresql://edge:local@127.0.0.1:5432/manut",
          } as Hyperdrive,
        }),
      ),
    ).toThrow(/HYPERDRIVE_NOT_PROVISIONED|Database capability is disabled/i);
  });

  it("exposes the Hyperdrive connection string only through the binding", () => {
    const connectionString =
      "postgresql://edge:local@127.0.0.1:5432/manut_hyperdrive";
    expect(
      hyperdriveConnectionString(
        testEnv({
          ENABLE_HYPERDRIVE_BOUNDARY: "true",
          HYPERDRIVE_DATABASE: { connectionString } as Hyperdrive,
        }),
      ),
    ).toBe(connectionString);
  });

  it("reports Hyperdrive readiness without leaking the connection string", async () => {
    const app = createEdgeApp({ verifyToken });
    const connectionString =
      "postgresql://edge:secret-user@127.0.0.1:5432/manut_hyperdrive";
    const response = await app.request(
      "https://intranet.example/api/v1/platform/hyperdrive",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({
        ENABLE_HYPERDRIVE_BOUNDARY: "true",
        HYPERDRIVE_DATABASE: { connectionString } as Hyperdrive,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain(connectionString);
    expect(body).not.toContain("secret-user");
    expect(JSON.parse(body)).toMatchObject({
      binding: "HYPERDRIVE_DATABASE",
      ready: true,
      source: "hyperdrive",
    });
  });

  it("keeps the platform Hyperdrive probe fail-closed when disabled", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/v1/platform/hyperdrive",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
  });
});
