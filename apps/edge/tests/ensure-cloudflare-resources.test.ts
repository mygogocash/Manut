/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  collectResourceNames,
  createWranglerExec,
  ensureResource,
  ensureResources,
  type WranglerExec,
  type WranglerExecResult,
} from "../scripts/ensure-cloudflare-resources.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const wranglerSource = readFileSync(
  join(repoRoot, "apps/edge/wrangler.jsonc"),
  "utf8",
);

const ok: WranglerExecResult = { code: 0, stdout: "", stderr: "" };
const fail = (stderr: string): WranglerExecResult => ({
  code: 1,
  stdout: "",
  stderr,
});

function scriptedExec(results: readonly WranglerExecResult[]): {
  exec: WranglerExec;
  calls: string[][];
} {
  const remaining = [...results];
  const calls: string[][] = [];
  const exec: WranglerExec = (args) => {
    calls.push([...args]);
    const next = remaining.shift();
    if (!next) {
      throw new Error(`Unscripted wrangler call: ${args.join(" ")}`);
    }
    return Promise.resolve(next);
  };
  return { exec, calls };
}

describe("ensure-cloudflare-resources > collectResourceNames", () => {
  it("given the committed wrangler.jsonc and production > then returns the two jobs queues and the uploads bucket", () => {
    const plan = collectResourceNames(wranglerSource, "production");
    expect(plan.queues).toEqual([
      "manut-intranet-jobs-production",
      "manut-intranet-jobs-production-dlq",
    ]);
    expect(plan.r2Buckets).toEqual(["manut-intranet-uploads-production"]);
  });

  it("given the committed wrangler.jsonc and staging > then returns the staging queue pair and bucket", () => {
    const plan = collectResourceNames(wranglerSource, "staging");
    expect(plan.queues).toEqual([
      "manut-intranet-jobs-staging",
      "manut-intranet-jobs-staging-dlq",
    ]);
    expect(plan.r2Buckets).toEqual(["manut-intranet-uploads-staging"]);
  });

  it("given the committed wrangler.jsonc and preview > then returns preview names and excludes preview_bucket_name", () => {
    const plan = collectResourceNames(wranglerSource, "preview");
    expect(plan.queues).toEqual([
      "manut-intranet-jobs-preview",
      "manut-intranet-jobs-preview-dlq",
    ]);
    expect(plan.r2Buckets).toEqual(["manut-intranet-uploads-preview"]);
  });

  it("given producers, consumers and dead_letter_queue sharing names > then dedupes and sorts", () => {
    const fixture = `{
      // synthetic fixture: consumer repeats the producer queue names
      "env": {
        "unit": {
          "queues": {
            "producers": [
              { "binding": "JOB_QUEUE", "queue": "shared-jobs" },
              { "binding": "DEAD_LETTER_QUEUE", "queue": "shared-jobs-dlq" },
            ],
            "consumers": [
              { "queue": "shared-jobs", "dead_letter_queue": "shared-jobs-dlq" },
            ],
          },
          "r2_buckets": [
            {
              "binding": "UPLOADS",
              "bucket_name": "unit-bucket",
              "preview_bucket_name": "unit-bucket-preview",
            },
          ],
        },
      },
    }`;
    const plan = collectResourceNames(fixture, "unit");
    expect(plan.queues).toEqual(["shared-jobs", "shared-jobs-dlq"]);
    expect(plan.r2Buckets).toEqual(["unit-bucket"]);
  });

  it("given a producer entry without a queue name > then throws instead of provisioning a partial plan", () => {
    const fixture = `{
      "env": {
        "unit": {
          "queues": { "producers": [{ "binding": "JOB_QUEUE" }] },
        },
      },
    }`;
    expect(() => collectResourceNames(fixture, "unit")).toThrow(/queue/u);
  });

  it("given an unknown env > then throws and lists the available envs", () => {
    expect(() => collectResourceNames(wranglerSource, "does-not-exist")).toThrow(
      /does-not-exist[\s\S]*production/u,
    );
  });

  it("given invalid JSONC > then throws instead of returning partial config", () => {
    expect(() => collectResourceNames("{ not valid jsonc", "production")).toThrow(
      /parse/iu,
    );
  });
});

describe("ensure-cloudflare-resources > ensureResource", () => {
  it("given info succeeds > then reports exists and never calls create", async () => {
    const { exec, calls } = scriptedExec([ok]);
    await expect(ensureResource("queue", "q-one", exec)).resolves.toBe("exists");
    expect(calls).toEqual([["queues", "info", "q-one"]]);
  });

  it("given info misses and create succeeds > then reports created", async () => {
    const { exec, calls } = scriptedExec([fail("not found"), ok]);
    await expect(ensureResource("queue", "q-one", exec)).resolves.toBe(
      "created",
    );
    expect(calls).toEqual([
      ["queues", "info", "q-one"],
      ["queues", "create", "q-one"],
    ]);
  });

  it("given create fails but a recheck finds the resource > then reports exists (parallel deploy race)", async () => {
    const { exec, calls } = scriptedExec([
      fail("not found"),
      fail("a peer deploy created it first"),
      ok,
    ]);
    await expect(
      ensureResource("r2-bucket", "bucket-one", exec),
    ).resolves.toBe("exists");
    expect(calls).toEqual([
      ["r2", "bucket", "info", "bucket-one"],
      ["r2", "bucket", "create", "bucket-one"],
      ["r2", "bucket", "info", "bucket-one"],
    ]);
  });

  it("given info, create and recheck all fail > then rejects with every stderr (auth fail-closed)", async () => {
    const { exec } = scriptedExec([
      fail("info-authentication-error"),
      fail("create-authentication-error"),
      fail("recheck-authentication-error"),
    ]);
    await expect(ensureResource("queue", "q-one", exec)).rejects.toThrow(
      /info-authentication-error[\s\S]*create-authentication-error[\s\S]*recheck-authentication-error/u,
    );
  });
});

describe("ensure-cloudflare-resources > createWranglerExec", () => {
  it("resolves the workspace-pinned wrangler binary without throwing", () => {
    // wrangler's exports map does not expose ./bin/wrangler.js directly;
    // resolution must go through the exported package.json bin field.
    expect(typeof createWranglerExec()).toBe("function");
  });
});

describe("ensure-cloudflare-resources > ensureResources", () => {
  it("given production and an injected exec > then ensures both queues before the bucket", async () => {
    const { exec, calls } = scriptedExec([ok, ok, ok]);
    const outcomes = await ensureResources({
      envName: "production",
      wranglerSource,
      exec,
    });
    expect(calls).toEqual([
      ["queues", "info", "manut-intranet-jobs-production"],
      ["queues", "info", "manut-intranet-jobs-production-dlq"],
      ["r2", "bucket", "info", "manut-intranet-uploads-production"],
    ]);
    expect(outcomes).toEqual([
      { kind: "queue", name: "manut-intranet-jobs-production", outcome: "exists" },
      {
        kind: "queue",
        name: "manut-intranet-jobs-production-dlq",
        outcome: "exists",
      },
      {
        kind: "r2-bucket",
        name: "manut-intranet-uploads-production",
        outcome: "exists",
      },
    ]);
  });
});
