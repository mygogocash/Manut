import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import test from 'ava';
import express from 'express';
import request from 'supertest';

import { Namespace } from '../../../env';
import { StaticFilesResolver } from '../static';

const mobileUA =
  'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

function initStaticFixture(root: string) {
  const staticRoot = join(root, 'static');

  const files: Array<[string, string]> = [
    ['index.html', 'web-index'],
    ['admin/index.html', 'admin-index'],
    ['assets/main.js', 'web-asset'],
    ['mobile/index.html', 'mobile-index'],
    ['mobile/assets/main.js', 'mobile-asset'],
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
    } as any
  );
  resolver.onModuleInit();
  return app;
}

test.serial('serves admin files and admin route fallback', async t => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'affine-static-files-'));
  initStaticFixture(fixtureRoot);

  const prevProjectRoot = env.projectRoot;
  const prevNamespace = env.NAMESPACE;

  try {
    // @ts-expect-error test override
    env.projectRoot = fixtureRoot;
    // @ts-expect-error test override
    env.NAMESPACE = Namespace.Production;

    const app = await createApp();

    const indexRes = await request(app).get('/admin/index.html').expect(200);
    t.is(indexRes.text, 'admin-index');

    const fallbackRes = await request(app).get('/admin/settings').expect(200);
    t.is(fallbackRes.text, 'admin-index');
  } finally {
    // @ts-expect-error test override
    env.projectRoot = prevProjectRoot;
    // @ts-expect-error test override
    env.NAMESPACE = prevNamespace;
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test.serial(
  'serves static assets from prefixed paths and returns 404 on missing',
  async t => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'affine-static-files-'));
    initStaticFixture(fixtureRoot);

    const prevProjectRoot = env.projectRoot;
    const prevNamespace = env.NAMESPACE;

    try {
      // @ts-expect-error test override
      env.projectRoot = fixtureRoot;
      // @ts-expect-error test override
      env.NAMESPACE = Namespace.Production;

      const app = await createApp();

      const assetRes = await request(app).get('/assets/main.js').expect(200);
      t.is(assetRes.text, 'web-asset');

      await request(app).get('/assets/missing.js').expect(404);
    } finally {
      // @ts-expect-error test override
      env.projectRoot = prevProjectRoot;
      // @ts-expect-error test override
      env.NAMESPACE = prevNamespace;
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }
);

test.serial(
  'matches front container index behavior and cache header',
  async t => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'affine-static-files-'));
    initStaticFixture(fixtureRoot);

    const prevProjectRoot = env.projectRoot;
    const prevNamespace = env.NAMESPACE;

    try {
      // @ts-expect-error test override
      env.projectRoot = fixtureRoot;
      // @ts-expect-error test override
      env.NAMESPACE = Namespace.Production;

      const app = await createApp();

      const indexRes = await request(app).get('/index.html').expect(200);
      t.is(indexRes.text, 'web-index');
      t.is(
        indexRes.headers['cache-control'],
        'private, no-cache, no-store, max-age=0, must-revalidate'
      );

      const fallbackRes = await request(app).get('/workspace/path').expect(200);
      t.is(fallbackRes.text, 'web-index');
    } finally {
      // @ts-expect-error test override
      env.projectRoot = prevProjectRoot;
      // @ts-expect-error test override
      env.NAMESPACE = prevNamespace;
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }
);

test.serial('serves exported legal pages before the SPA fallback', async t => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'affine-static-files-'));
  initStaticFixture(fixtureRoot);

  const staticRoot = join(fixtureRoot, 'static');
  const files: Array<[string, string]> = [
    ['landing/privacy.html', 'privacy-google-legal'],
    ['landing/privacy-policy.html', 'privacy-policy-google-legal'],
    ['landing/legal/privacy/index.html', 'legal-privacy-google-social'],
    ['landing/legal/terms/index.html', 'legal-terms-google-social'],
    [
      'landing/legal/data-deletion-instructions/index.html',
      'legal-data-deletion-instructions',
    ],
    ['landing/terms/index.html', 'terms-google-legal'],
    ['landing/terms-of-service/index.html', 'terms-of-service-google-legal'],
  ];
  for (const [file, content] of files) {
    const fullPath = join(staticRoot, file);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }

  const prevProjectRoot = env.projectRoot;
  const prevNamespace = env.NAMESPACE;

  try {
    // @ts-expect-error test override
    env.projectRoot = fixtureRoot;
    // @ts-expect-error test override
    env.NAMESPACE = Namespace.Production;

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

    const legalPrivacyRes = await request(app)
      .get('/legal/privacy')
      .expect(200);
    t.is(legalPrivacyRes.text, 'legal-privacy-google-social');

    const legalTermsRes = await request(app).get('/legal/terms').expect(200);
    t.is(legalTermsRes.text, 'legal-terms-google-social');

    const dataDeletionRes = await request(app)
      .get('/legal/data-deletion-instructions')
      .expect(200);
    t.is(dataDeletionRes.text, 'legal-data-deletion-instructions');
  } finally {
    // @ts-expect-error test override
    env.projectRoot = prevProjectRoot;
    // @ts-expect-error test override
    env.NAMESPACE = prevNamespace;
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test.serial('uses mobile root only in dev namespace for mobile UA', async t => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'affine-static-files-'));
  initStaticFixture(fixtureRoot);

  const prevProjectRoot = env.projectRoot;
  const prevNamespace = env.NAMESPACE;

  try {
    // @ts-expect-error test override
    env.projectRoot = fixtureRoot;
    // @ts-expect-error test override
    env.NAMESPACE = Namespace.Dev;

    const app = await createApp();

    const mobileAssetRes = await request(app)
      .get('/assets/main.js')
      .set('user-agent', mobileUA)
      .expect(200);
    t.is(mobileAssetRes.text, 'mobile-asset');

    const webAssetRes = await request(app).get('/assets/main.js').expect(200);
    t.is(webAssetRes.text, 'web-asset');

    const mobileFromHint = await request(app)
      .get('/assets/main.js')
      .set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .set('sec-ch-ua-mobile', '?1')
      .expect(200);
    t.is(mobileFromHint.text, 'mobile-asset');

    const desktopFromHint = await request(app)
      .get('/assets/main.js')
      .set('user-agent', mobileUA)
      .set('sec-ch-ua-mobile', '?0')
      .expect(200);
    t.is(desktopFromHint.text, 'web-asset');

    const mobileFromPlatformHint = await request(app)
      .get('/assets/main.js')
      .set('sec-ch-ua-platform', '"Android"')
      .expect(200);
    t.is(mobileFromPlatformHint.text, 'mobile-asset');
  } finally {
    // @ts-expect-error test override
    env.projectRoot = prevProjectRoot;
    // @ts-expect-error test override
    env.NAMESPACE = prevNamespace;
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
