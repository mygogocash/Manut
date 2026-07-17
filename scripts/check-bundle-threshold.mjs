import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const exportRoot = resolve(root, process.argv[2] ?? "apps/app/dist");
const maximumBytes = 650 * 1024;

function collectJavaScript(path, files) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isFile()) {
    if (path.endsWith(".js")) files.push(path);
    return;
  }
  for (const entry of readdirSync(path)) {
    collectJavaScript(join(path, entry), files);
  }
}

const files = [];
collectJavaScript(exportRoot, files);
if (files.length === 0) {
  throw new Error(`No JavaScript bundles found under ${exportRoot}`);
}

const failures = [];
for (const path of files.sort()) {
  const bytes = readFileSync(path);
  const transferredBytes = gzipSync(bytes, { level: 9 }).byteLength;
  const label = relative(root, path);
  console.log(
    `${label}: ${Math.ceil(bytes.byteLength / 1024)} KiB raw, ${Math.ceil(transferredBytes / 1024)} KiB gzip`,
  );
  if (transferredBytes > maximumBytes) {
    failures.push(
      `${label} is ${Math.ceil(transferredBytes / 1024)} KiB gzip (limit 650 KiB)`,
    );
  }
}

if (failures.length > 0) {
  console.error("First-load JavaScript threshold exceeded:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Bundle threshold passed (${files.length} JavaScript files).`);
