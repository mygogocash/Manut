import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const sourcePath = join(
  process.cwd(),
  'src/plugins/copilot/security/authorized-retrieval-filter.ts'
);

test('authorized retrieval filter > given NestJS constructor dependencies > then imports DI targets at runtime', t => {
  const source = readFileSync(sourcePath, 'utf8');

  t.false(
    /import\s+type\s*\{\s*AccessController\s*\}/.test(source),
    'AccessController must be a runtime import so NestJS can resolve constructor metadata'
  );
  t.false(
    /import\s+type\s*\{\s*Models\s*\}/.test(source),
    'Models must be a runtime import so NestJS can resolve constructor metadata'
  );
  t.regex(source, /import\s*\{\s*AccessController\s*\}/);
  t.regex(source, /import\s*\{\s*Models\s*\}/);
});
