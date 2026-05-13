import test from 'ava';

import { DeploymentType, Env } from '../../../env';
import { isAnalyticsModuleEnabled } from '../feature-flag';

const originalEnv = { ...process.env };
const originalGlobalEnv = globalThis.env;

test.afterEach.always(() => {
  process.env = { ...originalEnv };
  globalThis.env = originalGlobalEnv;
});

function setEnv(vars: Record<string, string | undefined>) {
  process.env = { ...originalEnv };
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  globalThis.env = new Env();
}

test('ENABLE_ANALYTICS_MODULE=true forces on regardless of DEPLOYMENT_TYPE', t => {
  setEnv({ ENABLE_ANALYTICS_MODULE: 'true', DEPLOYMENT_TYPE: 'affine' });
  t.true(isAnalyticsModuleEnabled());
});

test('ENABLE_ANALYTICS_MODULE=false forces off regardless of DEPLOYMENT_TYPE', t => {
  setEnv({ ENABLE_ANALYTICS_MODULE: 'false', DEPLOYMENT_TYPE: 'selfhosted' });
  t.false(isAnalyticsModuleEnabled());
});

test('Explicit DEPLOYMENT_TYPE=selfhosted enables the module', t => {
  setEnv({ ENABLE_ANALYTICS_MODULE: undefined, DEPLOYMENT_TYPE: 'selfhosted' });
  t.true(isAnalyticsModuleEnabled());
});

test('Explicit DEPLOYMENT_TYPE=affine disables the module', t => {
  setEnv({ ENABLE_ANALYTICS_MODULE: undefined, DEPLOYMENT_TYPE: 'affine' });
  t.false(isAnalyticsModuleEnabled());
});

// Production parity check: when no env vars are set, the Env class
// defaults DEPLOYMENT_TYPE to 'selfhosted' (the /info endpoint reports
// "type":"selfhosted" via this same default). The analytics gate must
// follow the same default, otherwise selfhosted operators get a broken
// "Analytics · Connections" panel because process.env.DEPLOYMENT_TYPE
// is undefined on a bare compose.yml — exactly the bug observed on
// manut.gogocash.co.
test('Defaults to enabled when no env vars are set in production', t => {
  setEnv({
    ENABLE_ANALYTICS_MODULE: undefined,
    DEPLOYMENT_TYPE: undefined,
    NODE_ENV: 'production',
  });
  t.is(globalThis.env.DEPLOYMENT_TYPE, DeploymentType.Selfhosted);
  t.true(isAnalyticsModuleEnabled());
});
