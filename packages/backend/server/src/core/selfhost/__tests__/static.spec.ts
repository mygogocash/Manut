import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import test from 'ava';
import express from 'express';
import request from 'supertest';

import { StaticFilesResolver } from '../static';

function initStaticFixture(root: string) {
  const staticRoot = join(root, 'static');
  const files: Array<[string, string]> = [
    ['selfhost.html', 'selfhost-app'],
    ['js/index.12345678.js', 'app-bundle'],
    ['landing/index.html', 'landing-index'],
    ['landing/privacy.html', 'privacy-google-legal'],
    ['landing/privacy-policy.html', 'privacy-policy-google-legal'],
    ['landing/terms/index.html', 'terms-google-legal'],
    ['landing/terms-of-service/index.html', 'terms-of-service-google-legal'],
  ];

  for (const [file, content] of files) {
    const fullPath = join(staticRoot, file);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

async function createApp(basePath = '') {
  const app = express();
  const resolver = new StaticFilesResolver(
    { server: { path: basePath } } as any,
    {
      httpAdapter: {
        getInstance: () => app,
      },
    } as any,
    {
      use: (_req: unknown, _res: unknown, next: () => void) => next(),
    } as any
  );
  resolver.onModuleInit();
  return app;
}

test.serial('serves legal pages before selfhost app fallback', async t => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'affine-selfhost-static-'));

  const prevProjectRoot = env.projectRoot;
  const prevDeploymentType = env.DEPLOYMENT_TYPE;

  try {
    initStaticFixture(fixtureRoot);
    // @ts-expect-error test override
    env.projectRoot = fixtureRoot;
    // @ts-expect-error test override
    env.DEPLOYMENT_TYPE = 'selfhosted';

    const app = await createApp();

    const privacyRes = await request(app).get('/privacy').expect(200);
    t.is(privacyRes.text, 'privacy-google-legal');

    const privacyPolicyRes = await request(app)
      .get('/privacy-policy')
      .expect(200);
    t.is(privacyPolicyRes.text, 'privacy-policy-google-legal');

    const termsRes = await request(app).get('/terms').expect(200);
    t.is(termsRes.text, 'terms-google-legal');

    const termsOfServiceRes = await request(app)
      .get('/terms-of-service')
      .expect(200);
    t.is(termsOfServiceRes.text, 'terms-of-service-google-legal');

    const fallbackRes = await request(app).get('/workspace/path').expect(200);
    t.is(fallbackRes.text, 'selfhost-app');
  } finally {
    // @ts-expect-error test override
    env.projectRoot = prevProjectRoot;
    // @ts-expect-error test override
    env.DEPLOYMENT_TYPE = prevDeploymentType;
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test.serial(
  'returns 404 for missing selfhost static assets instead of app html',
  async t => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'affine-selfhost-static-'));

    const prevProjectRoot = env.projectRoot;
    const prevDeploymentType = env.DEPLOYMENT_TYPE;

    try {
      initStaticFixture(fixtureRoot);
      // @ts-expect-error test override
      env.projectRoot = fixtureRoot;
      // @ts-expect-error test override
      env.DEPLOYMENT_TYPE = 'selfhosted';

      const app = await createApp();

      const assetRes = await request(app)
        .get('/js/index.12345678.js')
        .expect(200);
      t.is(assetRes.text, 'app-bundle');

      const missingRes = await request(app)
        .get('/js/index.deadbeef.js')
        .expect(404);
      t.is(missingRes.text, '');

      const fallbackRes = await request(app).get('/workspace/path').expect(200);
      t.is(fallbackRes.text, 'selfhost-app');
    } finally {
      // @ts-expect-error test override
      env.projectRoot = prevProjectRoot;
      // @ts-expect-error test override
      env.DEPLOYMENT_TYPE = prevDeploymentType;
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }
);
