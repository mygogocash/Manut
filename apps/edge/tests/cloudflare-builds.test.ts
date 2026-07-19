/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function productionWorkerName(wranglerSource: string): string | null {
  const productionBlock = wranglerSource.match(
    /"production"\s*:\s*\{([\s\S]*?)\n\s{4}\},?\n\s*\}/u,
  )?.[1];
  if (!productionBlock) return null;
  return productionBlock.match(/^\s*"name"\s*:\s*"([^"]+)"/mu)?.[1] ?? null;
}

describe("Cloudflare Workers Builds contract", () => {
  it("root package.json exposes build:cloudflare that generates Prisma then exports web (not turbo build)", () => {
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    const script = pkg.scripts?.["build:cloudflare"];
    expect(script).toBeTruthy();
    expect(script).toContain("db:generate");
    expect(script).toContain("@manut/app");
    expect(script).toContain("export:web");
    expect(script).not.toMatch(/\bturbo\b/u);
  });

  it("generates Prisma before the PR Worker type-check", () => {
    const workflow = readFileSync(
      join(repoRoot, ".github/workflows/pr-checks.yml"),
      "utf8",
    );
    const workerJob = workflow.match(
      /^ {2}worker-build:\s*\n([\s\S]*?)(?=^ {2}[a-z][a-z-]+:\s*$)/mu,
    )?.[1];

    expect(workerJob).toBeTruthy();
    expect(workerJob?.indexOf("pnpm db:generate")).toBeGreaterThan(-1);
    expect(workerJob?.indexOf("pnpm db:generate")).toBeLessThan(
      workerJob?.indexOf("pnpm --filter @manut/edge type-check") ?? -1,
    );
  });

  it("wrangler production Worker name matches Cloudflare service manut", () => {
    const wrangler = readFileSync(
      join(repoRoot, "apps/edge/wrangler.jsonc"),
      "utf8",
    );
    expect(productionWorkerName(wrangler)).toBe("manut");
  });

  it("wrangler secrets.required lists only EDGE_SIGNING_KEY (R2 S3 keys optional)", () => {
    const wrangler = readFileSync(
      join(repoRoot, "apps/edge/wrangler.jsonc"),
      "utf8",
    );

    const requiredBlocks = [
      ...wrangler.matchAll(/"secrets"\s*:\s*\{\s*"required"\s*:\s*\[([^\]]+)\]/gu),
    ].map((match) => match[1] ?? "");
    expect(requiredBlocks.length).toBeGreaterThanOrEqual(6);

    for (const block of requiredBlocks) {
      expect(block).toContain("EDGE_SIGNING_KEY");
      expect(block).not.toContain("R2_ACCESS_KEY_ID");
      expect(block).not.toContain("R2_SECRET_ACCESS_KEY");
      expect(block).not.toContain("R2_ACCOUNT_ID");
    }
  });

  it("wrangler omits routes so dashboard custom domains are not stripped on deploy", () => {
    const wrangler = readFileSync(
      join(repoRoot, "apps/edge/wrangler.jsonc"),
      "utf8",
    );
    expect(wrangler).not.toMatch(/^\s*"routes"\s*:/mu);
    expect(wrangler).toMatch(/dashboard-managed custom domains/iu);
  });

  it("wrangler production and preview leave API_ORIGIN empty and keep Hyperdrive off", () => {
    const wrangler = readFileSync(
      join(repoRoot, "apps/edge/wrangler.jsonc"),
      "utf8",
    );

    const envVars = (envName: string): string => {
      const block = wrangler.match(
        new RegExp(
          `"${envName}"\\s*:\\s*\\{([\\s\\S]*?)\\n\\s{4}\\},?\\n`,
          "u",
        ),
      )?.[1];
      expect(block).toBeTruthy();
      return block ?? "";
    };

    const readVar = (block: string, key: string): string | undefined =>
      block.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, "u"))?.[1];

    const production = envVars("production");
    // Fail closed until ops provisions a distinct Express origin (not Worker).
    expect(readVar(production, "API_ORIGIN")).toBe("");
    expect(readVar(production, "TRUSTED_STORAGE_ORIGINS")).toBe(
      "https://app.manut.xyz",
    );
    expect(readVar(production, "ENABLE_HYPERDRIVE_BOUNDARY")).toBe("false");
    expect(readVar(production, "ENABLE_LOCAL_R2_STREAMING")).toBe("false");
    expect(readVar(production, "R2_BUCKET_NAME")).toBe(
      "manut-intranet-uploads-production",
    );

    const preview = envVars("preview");
    expect(readVar(preview, "name")).toBe("manut-preview");
    expect(readVar(preview, "API_ORIGIN")).toBe("");
    expect(readVar(preview, "TRUSTED_STORAGE_ORIGINS")).toBe(
      "https://preview.manut.xyz",
    );
    expect(readVar(preview, "ENABLE_HYPERDRIVE_BOUNDARY")).toBe("false");
  });

  it("docs/CICD_CLOUDFLARE.md documents Workers Builds paste settings", () => {
    const doc = readFileSync(join(repoRoot, "docs/CICD_CLOUDFLARE.md"), "utf8");
    expect(doc).toContain("build:cloudflare");
    expect(doc).toContain("wrangler deploy --env production");
    expect(doc).toContain("wrangler deploy --env preview");
    expect(doc).not.toContain("versions upload --env preview");
    expect(doc).toContain("24.18.0");
    expect(doc).toMatch(/Why `pnpm run build` fails/iu);
    expect(doc).toContain("CLOUDFLARE_BINDINGS.md");
    expect(doc).not.toMatch(
      /\|\s*`EXPO_PUBLIC_SUPABASE_[^`]+`\s*\|\s*yes\s*\|/u,
    );
  });

  it("docs/CICD_CLOUDFLARE.md self-provisions queues/R2 before deploys and documents Queues Edit token permission", () => {
    const doc = readFileSync(join(repoRoot, "docs/CICD_CLOUDFLARE.md"), "utf8");
    expect(doc).toContain(
      "node scripts/ensure-cloudflare-resources.mjs --env production && npx wrangler deploy --env production",
    );
    expect(doc).toContain(
      "node scripts/ensure-cloudflare-resources.mjs --env preview && npx wrangler deploy --env preview",
    );
    expect(doc).toMatch(/Queues[^\n]*Edit/u);
    expect(doc).toMatch(/\*\*Edit\*\* \(not \*\*Roll\*\*\)/u);
  });

  it("documents a production-isolated preview Worker for Durable Object migrations", () => {
    const doc = readFileSync(join(repoRoot, "docs/CICD_CLOUDFLARE.md"), "utf8");
    const bootstrap = readFileSync(
      join(repoRoot, "scripts/setup-cloudflare-deploy-secrets.sh"),
      "utf8",
    );

    expect(doc).toContain("manut-preview");
    expect(doc).toMatch(/Durable Object[^\n]*migration/iu);
    expect(doc).toMatch(/Preview must not\s+use the Worker name `manut`/u);
    expect(bootstrap).toContain(
      'set_env_var preview EXPO_PUBLIC_API_URL "https://manut-preview.bettergogocash.workers.dev/api"',
    );
    expect(bootstrap).not.toContain(
      'set_env_var preview EXPO_PUBLIC_API_URL "https://preview.manut.xyz"',
    );
    expect(bootstrap).not.toMatch(
      /set_env_var preview EXPO_PUBLIC_API_URL "https:\/\/manut-preview\.bettergogocash\.workers\.dev"/u,
    );
    expect(bootstrap).toContain(
      'set_env_secret preview EDGE_SIGNING_KEY "$preview_signing_key"',
    );
    expect(bootstrap).toContain(
      'set_env_secret preview R2_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID"',
    );
    expect(bootstrap).toContain(
      'set_env_secret preview R2_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY"',
    );
    expect(bootstrap).toMatch(/R2 S3 pair unset|binding-only uploads/u);
    expect(bootstrap).not.toContain("put_worker_secret");
    expect(bootstrap).not.toMatch(/set_env_(?:secret|var) production/u);
  });

  it("docs/CLOUDFLARE_BINDINGS.md rejects D1 as SoR and lists required bindings", () => {
    const doc = readFileSync(
      join(repoRoot, "docs/CLOUDFLARE_BINDINGS.md"),
      "utf8",
    );
    expect(doc).toContain("HYPERDRIVE_DATABASE");
    expect(doc).toContain("UPLOADS");
    expect(doc).toContain("REALTIME_ROOMS");
    expect(doc).toContain("QUEUE_LEDGER");
    expect(doc).toContain("JOB_QUEUE");
    expect(doc).toContain("DEAD_LETTER_QUEUE");
    expect(doc).toContain("BACKGROUND_WORKFLOW");
    expect(doc).toContain("API_RATE_LIMITER");
    expect(doc).toMatch(/Cancel/iu);
    expect(doc).toMatch(/never D1/iu);
  });

  it("wrangler.jsonc has no D1 databases and keeps hyperdrive empty until provisioned", () => {
    const wrangler = readFileSync(
      join(repoRoot, "apps/edge/wrangler.jsonc"),
      "utf8",
    );
    expect(wrangler).not.toMatch(/d1_databases/u);
    expect(wrangler).toMatch(/"hyperdrive"\s*:\s*\[\s*\]/u);
    expect(wrangler).toContain('binding": "UPLOADS"');
    expect(wrangler).toContain("HYPERDRIVE_DATABASE");
  });
});
