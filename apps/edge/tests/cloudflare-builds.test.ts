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

  it("wrangler production Worker name matches Cloudflare service manut", () => {
    const wrangler = readFileSync(
      join(repoRoot, "apps/edge/wrangler.jsonc"),
      "utf8",
    );
    expect(productionWorkerName(wrangler)).toBe("manut");
  });

  it("wrangler production and preview set same-origin API_ORIGIN and keep Hyperdrive off", () => {
    const wrangler = readFileSync(
      join(repoRoot, "apps/edge/wrangler.jsonc"),
      "utf8",
    );

    const envVars = (envName: string): string => {
      const block = wrangler.match(
        new RegExp(`"${envName}"\\s*:\\s*\\{([\\s\\S]*?)\\n\\s{4}\\},?\\n`, "u"),
      )?.[1];
      expect(block).toBeTruthy();
      return block ?? "";
    };

    const readVar = (block: string, key: string): string | undefined =>
      block.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, "u"))?.[1];

    const production = envVars("production");
    expect(readVar(production, "API_ORIGIN")).toBe("https://manu.xyz");
    expect(readVar(production, "TRUSTED_STORAGE_ORIGINS")).toBe(
      "https://manu.xyz",
    );
    expect(readVar(production, "ENABLE_HYPERDRIVE_BOUNDARY")).toBe("false");
    expect(readVar(production, "ENABLE_LOCAL_R2_STREAMING")).toBe("false");
    expect(readVar(production, "R2_BUCKET_NAME")).toBe(
      "manut-intranet-uploads-production",
    );

    const preview = envVars("preview");
    expect(readVar(preview, "API_ORIGIN")).toBe("https://preview.manu.xyz");
    expect(readVar(preview, "TRUSTED_STORAGE_ORIGINS")).toBe(
      "https://preview.manu.xyz",
    );
    expect(readVar(preview, "ENABLE_HYPERDRIVE_BOUNDARY")).toBe("false");
  });

  it("docs/CICD_CLOUDFLARE.md documents Workers Builds paste settings", () => {
    const doc = readFileSync(
      join(repoRoot, "docs/CICD_CLOUDFLARE.md"),
      "utf8",
    );
    expect(doc).toContain("build:cloudflare");
    expect(doc).toContain("wrangler deploy --env production");
    expect(doc).toMatch(
      /versions upload --env preview|wrangler deploy --env preview/u,
    );
    expect(doc).toContain("24.18.0");
    expect(doc).toMatch(/Why `pnpm run build` fails/iu);
    expect(doc).toContain("CLOUDFLARE_BINDINGS.md");
    expect(doc).not.toMatch(
      /\|\s*`EXPO_PUBLIC_SUPABASE_[^`]+`\s*\|\s*yes\s*\|/u,
    );
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
