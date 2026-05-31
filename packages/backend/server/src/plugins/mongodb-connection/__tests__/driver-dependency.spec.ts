import { readFile } from 'node:fs/promises';

import test from 'ava';

test('mongodb runtime dependency > when server production deps are focused > then package declares mongodb', async t => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../../../package.json', import.meta.url), 'utf8')
  ) as { dependencies?: Record<string, string> };

  t.truthy(packageJson.dependencies?.mongodb);
});

test('mongodb runtime dependency > when server imports driver > then MongoClient is available', async t => {
  const driver = await import('mongodb');

  t.is(typeof driver.MongoClient, 'function');
});
