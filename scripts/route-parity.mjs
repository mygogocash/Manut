#!/usr/bin/env node
/**
 * Route parity: Express controllers vs Hono edge routes.
 *
 * Counts `router.<verb>('path'` in apps/api/src/modules/…/*.controller.ts
 * and `.<verb>('path'` in apps/edge/src/routes/*.ts, joined with mount bases
 * from modules/index.ts and routes/index.ts.
 *
 * Retire allowlist (not expected on edge):
 *   - /api/cron/* handlers live in edge-jobs → /api/cron/* fan-out (kept as thin mounts)
 *   - socket.io / realtime upgrade paths
 *
 * Usage:
 *   node scripts/route-parity.mjs
 *   node scripts/route-parity.mjs --json > docs/parity/route-parity.json
 *   node scripts/route-parity.mjs --fail   # exit 1 if coverage < threshold
 *
 * Env:
 *   PARITY_MIN_RATIO=0.65  (default; raise toward 1.0 as waves finish)
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const fail = process.argv.includes("--fail");
const asJson = process.argv.includes("--json");
const minRatio = Number(process.env.PARITY_MIN_RATIO ?? "0.80");

const VERB = /(?:^|[^\w.])(?:router|r)?\.(get|post|put|patch|delete)\s*\(\s*([`'"])([^`'"]+)\2/gim;
const MOUNT_EXPRESS = /app\.use\(\s*(['"`])(\/api\/[^'"`]+)\1\s*,\s*(\w+)/g;
const MOUNT_EDGE = /\.route\(\s*(['"`])(\/[^'"`]+)\1\s*,\s*(\w+)/g;

/** @param {string} dir @param {(n:string)=>boolean} pred */
function walk(dir, pred, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, pred, out);
    else if (pred(name)) out.push(p);
  }
  return out;
}

function joinPath(base, path) {
  if (path === "/" || path === "") return base;
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function parseMounts(file, re) {
  const text = readFileSync(file, "utf8");
  /** @type {Map<string, string>} varName → base */
  const map = new Map();
  for (const m of text.matchAll(re)) {
    map.set(m[3], m[2]);
  }
  return map;
}

function routesFromFile(file, base) {
  const text = readFileSync(file, "utf8");
  const routes = [];
  for (const m of text.matchAll(VERB)) {
    const method = m[1].toUpperCase();
    const path = m[3];
    routes.push({ method, path: joinPath(base, path), file: relative(root, file) });
  }
  return routes;
}

// Express: map export var → mount from modules/index.ts is lossy (import aliases).
// Fallback: count raw controller verbs and report totals; also emit per-file.
const expressControllers = walk(join(root, "apps/api/src/modules"), (n) => n.endsWith(".controller.ts"));
const expressRoutes = [];
for (const f of expressControllers) {
  expressRoutes.push(...routesFromFile(f, "")); // relative paths only
}

const edgeFiles = walk(join(root, "apps/edge/src/routes"), (n) => n.endsWith(".ts") && n !== "index.ts");
const edgeMounts = parseMounts(join(root, "apps/edge/src/routes/index.ts"), MOUNT_EDGE);
// Map file basename → mount: accounting.ts → accounting export → /accounting
const edgeRoutes = [];
for (const f of edgeFiles) {
  const baseName = f.split("/").pop().replace(/\.ts$/, "");
  // Find mount whose import path ends with /baseName
  let base = `/api/${baseName}`;
  for (const [varName, mount] of edgeMounts) {
    // Heuristic: kebab file names match mount path
    if (mount === `/${baseName}` || mount.endsWith(`/${baseName}`)) {
      base = `/api${mount}`;
      break;
    }
  }
  // investor-* special: mounts may be /investor/tasks etc — keep /api/<file>
  edgeRoutes.push(...routesFromFile(f, base));
}

const expressCount = expressRoutes.length;
const edgeCount = edgeRoutes.length;
const ratio = expressCount === 0 ? 1 : edgeCount / expressCount;

const byModule = new Map();
for (const r of expressRoutes) {
  const mod = r.file.split("/")[4] ?? r.file.split("/")[3] ?? "?";
  byModule.set(mod, (byModule.get(mod) ?? 0) + 1);
}
const edgeByFile = new Map();
for (const r of edgeRoutes) {
  const mod = r.file.split("/").pop().replace(/\.ts$/, "");
  edgeByFile.set(mod, (edgeByFile.get(mod) ?? 0) + 1);
}

const report = {
  generatedAt: new Date().toISOString(),
  expressControllerRoutes: expressCount,
  edgeRouteHandlers: edgeCount,
  ratio: Number(ratio.toFixed(4)),
  minRatio,
  pass: ratio >= minRatio,
  note:
    "Counts are syntactic (router/Hono verb literals). Absolute path join is best-effort; use --json and docs/parity for triage. Target: approach Express 1,304 minus retired cron/socket paths.",
  expressTopModules: [...byModule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
  edgeByFile: [...edgeByFile.entries()].sort((a, b) => b[1] - a[1]),
  retiredAllowlist: ["/api/cron/* → edge-jobs Cron + Queue", "socket.io → DO WebSocket (Phase 7)"],
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`route-parity: Express ${expressCount} vs Edge ${edgeCount} (${(ratio * 100).toFixed(1)}%)`);
  console.log(`threshold: ${(minRatio * 100).toFixed(0)}% → ${report.pass ? "PASS" : "BELOW"}`);
  console.log("\nTop Express modules by route count:");
  for (const [m, n] of report.expressTopModules.slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${m}`);
  console.log("\nEdge files by handler count:");
  for (const [m, n] of report.edgeByFile.slice(0, 20)) console.log(`  ${String(n).padStart(4)}  ${m}`);
}

const outPath = join(root, "docs/parity/route-parity-latest.json");
try {
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
} catch {
  /* docs/parity may be missing in some checkouts */
}

if (fail && !report.pass) process.exit(1);
