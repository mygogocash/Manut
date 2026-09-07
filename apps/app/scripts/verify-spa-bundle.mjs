#!/usr/bin/env node
/**
 * Fail closed after `expo export -p web` if the web bundle looks broken.
 * Staging went blank when Metro embedded two React copies — ExpoRoot then
 * calls useMemo against a null dispatcher ("Cannot read properties of null
 * (reading 'useMemo')") and #root stays empty.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve("dist");
const indexPath = resolve(dist, "index.html");
const jsDir = resolve(dist, "_expo/static/js/web");

function fail(msg) {
  console.error(`verify-spa-bundle: ${msg}`);
  process.exit(1);
}

if (!existsSync(indexPath)) fail("dist/index.html missing — export did not produce an SPA");

const index = readFileSync(indexPath, "utf8");
if (index.includes("Run pnpm --filter @nexora/app export:web")) {
  fail("dist/index.html is the ensure-spa-dist placeholder, not a real export");
}
if (!index.includes('id="root"') && !index.includes("id='root'")) {
  fail("dist/index.html has no #root mount node");
}

if (!existsSync(jsDir)) fail("_expo/static/js/web missing");
const entries = readdirSync(jsDir).filter((f) => /^entry-.*\.js$/.test(f));
if (entries.length === 0) fail("no entry-*.js web bundle");

for (const name of entries) {
  const body = readFileSync(resolve(jsDir, name), "utf8");
  const reactCopies = body.split("react.production").length - 1;
  if (reactCopies !== 1) {
    fail(
      `${name} embeds react.production ${reactCopies} time(s) (want 1). ` +
        "Duplicate React breaks Expo Router hooks on web.",
    );
  }
  if (body.length < 100_000) {
    fail(`${name} is suspiciously small (${body.length} bytes)`);
  }
}

console.log(`verify-spa-bundle: ok (${entries.join(", ")})`);
