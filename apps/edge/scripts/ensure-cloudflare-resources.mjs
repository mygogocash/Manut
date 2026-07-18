#!/usr/bin/env node
// Ensures the Cloudflare Queues and R2 buckets named in wrangler.jsonc exist
// before `wrangler deploy` / `wrangler versions upload`. Create-only: never
// deletes or reconfigures resources. Queue consumers, DO migrations, and
// Workflows are applied by `wrangler deploy` itself.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse, printParseErrorCode } from "jsonc-parser";

/** @typedef {{ code: number, stdout: string, stderr: string }} WranglerExecResult */
/** @typedef {(args: readonly string[]) => Promise<WranglerExecResult>} WranglerExec */
/** @typedef {"queue" | "r2-bucket"} ResourceKind */
/** @typedef {"exists" | "created"} EnsureOutcome */
/** @typedef {{ queues: string[], r2Buckets: string[] }} ResourcePlan */
/** @typedef {{ kind: ResourceKind, name: string, outcome: EnsureOutcome }} EnsuredResource */

const RESOURCE_COMMANDS = {
  queue: {
    info: (/** @type {string} */ name) => ["queues", "info", name],
    create: (/** @type {string} */ name) => ["queues", "create", name],
  },
  "r2-bucket": {
    info: (/** @type {string} */ name) => ["r2", "bucket", "info", name],
    create: (/** @type {string} */ name) => ["r2", "bucket", "create", name],
  },
};

/**
 * Pure: wrangler.jsonc source + env name -> deduped, sorted resource names.
 * `preview_bucket_name` is intentionally excluded (wrangler-dev only).
 *
 * @param {string} wranglerSource
 * @param {string} envName
 * @returns {ResourcePlan}
 */
export function collectResourceNames(wranglerSource, envName) {
  /** @type {import("jsonc-parser").ParseError[]} */
  const errors = [];
  const config = parse(wranglerSource, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const details = errors
      .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
      .join(", ");
    throw new Error(`Failed to parse wrangler config: ${details}`);
  }

  const envs = config?.env ?? {};
  const env = envs[envName];
  if (!env) {
    throw new Error(
      `Unknown wrangler env "${envName}". Available envs: ${Object.keys(envs).join(", ")}`,
    );
  }

  const queues = new Set();
  const addQueue = (
    /** @type {unknown} */ value,
    /** @type {string} */ context,
  ) => {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Missing queue name in ${context} for env "${envName}".`);
    }
    queues.add(value);
  };
  for (const producer of env.queues?.producers ?? []) {
    addQueue(producer.queue, "queues.producers");
  }
  for (const consumer of env.queues?.consumers ?? []) {
    addQueue(consumer.queue, "queues.consumers");
    if (consumer.dead_letter_queue !== undefined) {
      addQueue(consumer.dead_letter_queue, "queues.consumers.dead_letter_queue");
    }
  }

  const r2Buckets = new Set();
  for (const bucket of env.r2_buckets ?? []) {
    if (typeof bucket.bucket_name !== "string" || bucket.bucket_name.length === 0) {
      throw new Error(`Missing bucket_name in r2_buckets for env "${envName}".`);
    }
    r2Buckets.add(bucket.bucket_name);
  }

  return { queues: [...queues].sort(), r2Buckets: [...r2Buckets].sort() };
}

/**
 * Spawns the workspace-pinned wrangler (never PATH or an npx cache copy).
 *
 * @returns {WranglerExec}
 */
export function createWranglerExec() {
  const require = createRequire(import.meta.url);
  const wranglerBin = require.resolve("wrangler/bin/wrangler.js");
  const edgeDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  return (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [wranglerBin, ...args], {
        cwd: edgeDir,
        env: process.env,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });
}

/**
 * Idempotent ensure keyed on exit codes only (no error-text matching):
 * info -> (miss) create -> (fail) re-info. The recheck lets the loser of a
 * parallel-deploy creation race succeed. Any other failure throws with all
 * three stderr outputs so auth errors surface verbatim (fail-closed).
 *
 * @param {ResourceKind} kind
 * @param {string} name
 * @param {WranglerExec} exec
 * @returns {Promise<EnsureOutcome>}
 */
export async function ensureResource(kind, name, exec) {
  const commands = RESOURCE_COMMANDS[kind];
  if (!commands) {
    throw new Error(`Unknown resource kind "${kind}".`);
  }
  const info = await exec(commands.info(name));
  if (info.code === 0) return "exists";
  const create = await exec(commands.create(name));
  if (create.code === 0) return "created";
  const recheck = await exec(commands.info(name));
  if (recheck.code === 0) return "exists";
  throw new Error(
    `Failed to ensure ${kind} "${name}" (fail-closed).\n` +
      `--- info ---\n${info.stderr}\n` +
      `--- create ---\n${create.stderr}\n` +
      `--- recheck ---\n${recheck.stderr}`,
  );
}

/**
 * Ensures every queue, then every R2 bucket, for the given env. Sequential on
 * purpose: ordered logs and no concurrent create races against ourselves.
 *
 * @param {{ envName: string, wranglerSource: string, exec: WranglerExec }} options
 * @returns {Promise<EnsuredResource[]>}
 */
export async function ensureResources({ envName, wranglerSource, exec }) {
  const plan = collectResourceNames(wranglerSource, envName);
  /** @type {EnsuredResource[]} */
  const outcomes = [];
  for (const name of plan.queues) {
    const outcome = await ensureResource("queue", name, exec);
    console.log(`queue ${name}: ${outcome}`);
    outcomes.push({ kind: "queue", name, outcome });
  }
  for (const name of plan.r2Buckets) {
    const outcome = await ensureResource("r2-bucket", name, exec);
    console.log(`r2-bucket ${name}: ${outcome}`);
    outcomes.push({ kind: "r2-bucket", name, outcome });
  }
  return outcomes;
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const argv = process.argv.slice(2);
  const envFlagIndex = argv.indexOf("--env");
  const envName = envFlagIndex >= 0 ? argv[envFlagIndex + 1] : undefined;
  if (!envName) {
    console.error(
      "Usage: node scripts/ensure-cloudflare-resources.mjs --env <name>",
    );
    process.exit(2);
  }

  const wranglerConfigPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "wrangler.jsonc",
  );
  const wranglerSource = readFileSync(wranglerConfigPath, "utf8");

  try {
    collectResourceNames(wranglerSource, envName);
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(2);
  }

  try {
    await ensureResources({
      envName,
      wranglerSource,
      exec: createWranglerExec(),
    });
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  await main();
}
