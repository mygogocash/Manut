import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const dist = resolve("dist");
const index = resolve(dist, "index.html");
if (existsSync(index)) process.exit(0);
mkdirSync(dist, { recursive: true });
writeFileSync(
  index,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Intranet</title></head><body><main><h1>Intranet</h1><p>Run pnpm --filter @nexora/app export:web</p></main></body></html>\n`,
);
console.log("wrote placeholder dist/index.html");
