import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const policyKey = "manut-cleanroom-boundary-v1";
const fingerprints = new Map(
  [
    [21, ["07ae7d2dfd80075ea7c1ded7b42053444309b2ea0a773239734b63fcb5e95ad5"]],
    [
      20,
      [
        "2dd4baed40c14d69c26610681f18913b74cec180380f2f4445f713b67da8e28b",
        "aa990c2b963da99437f2aa05f76a07e368dea1e0fb4e42c6622db9915c4d8ee8",
      ],
    ],
    [19, ["7b19be9b13b8601b84fcff86026b573e231ce5dd8cb780bc0e4844366f521f78"]],
    [
      18,
      [
        "04a4cd241b5530f8d61e304eed1f7d8016c1d2f9342c08759cbb125c98935d6f",
        "07b1c8ca4d43e65883e04c110568182162a017f7a2b6153d798e12b5653e4543",
      ],
    ],
    [17, ["1f501932b1c19d779a83e843050a41f77c3125e32daac5ebb4af1ba1eb227f5c"]],
    [22, ["4b0977bcda7640b73c99cc38a0d623d0157ca7ad00927b0edb997232a51c9b46"]],
    [15, ["b010e178dfaa67ae50a002720bb5c12231da58ac716626207807ffd0723b6e36"]],
    [14, ["3460685cb59f97dcf195f17b7fa365138eac283e70e447ef90c59a9a0d6c8a54"]],
    [10, ["8e031777181549465dc6c56b75cb37414aa0cc86c24746d25df17990f05462fa"]],
    [9, ["3cfac0ac1c54057b37f63ac27079ff5f67b4b698937982ebcba7457844233aa7"]],
    [8, ["028ebbbb8114ea8ce23ceed7d73bc471caca92b273b05695708733487aa0c939"]],
    [
      7,
      [
        "621fcccf41dbf6bd8f62321e9cc0fa1826705692b8057843418325420d65fb6b",
        "84ddc0e0c0dc884d953bb8729a54f1619ac17ae831aff5e5bcb9d7a8b7db60c0",
      ],
    ],
    [6, ["c9a69f1d859482b8d2c676ba7384e33ea0f09dd0de979d31a104dfdac3923ed6"]],
    [
      4,
      [
        "a9135b4079035117d84bbe42179970d8a0bf475f99ec1d8a06326a9a7291063c",
        "a896896652d398b163a53da6c4f3686c178315252f763645d908bf064ec49ae3",
      ],
    ],
    [3, ["dbd2bda94a4f89268b7fad028d8f97a92919be1e178a5158350f22971e8cf903"]],
  ].map(([length, values]) => [length, new Set(values)]),
);

const legacyAssetHashes = new Set([
  "ca8c0fb163af96b9d80b9bbb7a5abdeeb8d7b62bd20fdd682dafc91c1252ad82",
]);
const ignoredRoots = [
  ".git/",
  ".next/",
  ".pnpm-store/",
  ".turbo/",
  ".wrangler/",
  "node_modules/",
];

function hmac(value) {
  return createHmac("sha256", policyKey).update(value).digest("hex");
}

function decodedVariants(input) {
  const variants = new Set([input.toLowerCase()]);
  const escaped = input
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replaceAll("\\/", "/");
  variants.add(escaped.toLowerCase());
  try {
    variants.add(decodeURIComponent(escaped).toLowerCase());
  } catch {
    // Malformed URL escapes are still scanned in their original form.
  }

  for (const value of [...variants]) {
    variants.add(value.replace(/[\s'"`+\\]/g, ""));
    for (const token of value.match(/[a-z0-9+/]{12,}={0,2}/gi) ?? []) {
      try {
        const decoded = Buffer.from(token, "base64").toString("utf8");
        if (/^[\x09\x0a\x0d\x20-\x7e]+$/.test(decoded)) {
          variants.add(decoded.toLowerCase());
        }
      } catch {
        // Invalid base64 is not a candidate encoding.
      }
    }
  }
  return variants;
}

function matchFingerprint(input) {
  for (const variant of decodedVariants(input)) {
    const tokens = variant.match(/[a-z0-9@][a-z0-9._:/@!\-]{1,240}/g) ?? [];
    for (const token of tokens) {
      const candidates = new Set([token]);
      for (const part of token.split(/[:/@._-]+/)) candidates.add(part);
      if (token.includes("@")) candidates.add(token.split("@").at(-1));
      try {
        const url = new URL(token.includes("://") ? token : `https://${token}`);
        candidates.add(url.hostname);
        candidates.add(url.pathname);
      } catch {
        // Not a URL-shaped token.
      }
      for (const candidate of candidates) {
        const expected = fingerprints.get(candidate.length);
        if (!expected) continue;
        const digest = hmac(candidate);
        if (expected.has(digest)) return digest;
      }
    }
  }
  return null;
}

function listGitFiles(args) {
  const [command, ...rest] = args;
  const result = spawnSync("git", [command, "-z", ...rest], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout.split("\0").filter(Boolean);
}

function walk(path, files) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isFile()) {
    files.add(path);
    return;
  }
  for (const entry of readdirSync(path)) walk(join(path, entry), files);
}

const candidates = new Set(
  listGitFiles(["ls-files", "--cached", "--others", "--exclude-standard"]).map(
    (path) => join(root, path),
  ),
);
for (const path of listGitFiles([
  "ls-files",
  "--others",
  "--ignored",
  "--exclude-standard",
  "--",
  ".env*",
  "**/.env*",
  ".dev.vars*",
  "**/.dev.vars*",
  "*.key",
  "**/*.key",
  "*.mobileprovision",
  "**/*.mobileprovision",
  "*.p12",
  "**/*.p12",
  "*.pem",
  "**/*.pem",
  ".playwright/**",
])) {
  if (!ignoredRoots.some((prefix) => path.startsWith(prefix))) {
    candidates.add(join(root, path));
  }
}
for (const requested of process.argv.slice(2)) {
  walk(join(root, requested), candidates);
}

const findings = [];
for (const absolute of candidates) {
  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 5_000_000) continue;

  const path = relative(root, absolute).replaceAll("\\", "/");
  const pathMatch = matchFingerprint(path);
  if (pathMatch)
    findings.push(`${path}: path fingerprint ${pathMatch.slice(0, 12)}`);

  const bytes = readFileSync(absolute);
  const assetHash = createHash("sha256").update(bytes).digest("hex");
  if (legacyAssetHashes.has(assetHash)) {
    findings.push(`${path}: prohibited legacy asset hash`);
    continue;
  }
  if (bytes.includes(0) || extname(path) === ".wasm") continue;
  const contentMatch = matchFingerprint(bytes.toString("utf8"));
  if (contentMatch) {
    findings.push(`${path}: content fingerprint ${contentMatch.slice(0, 12)}`);
  }
}

const baseSha = process.env.CREDENTIAL_SCAN_BASE_SHA;
if (baseSha) {
  const diff = spawnSync(
    "git",
    ["diff", "--no-ext-diff", `${baseSha}...HEAD`],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (diff.status !== 0) process.exit(diff.status ?? 1);
  const match = matchFingerprint(diff.stdout);
  if (match) findings.push(`commit range: fingerprint ${match.slice(0, 12)}`);
}

if (findings.length > 0) {
  console.error("Credential/provenance boundary violations:\n");
  for (const finding of findings.sort()) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Credential boundary passed (${candidates.size} files inspected).`);
