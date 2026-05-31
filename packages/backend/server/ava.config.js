const newE2E = process.env.TEST_MODE === 'e2e';
const newE2ETests = './src/__tests__/e2e/**/*.spec.ts';

const preludes = ['./src/prelude.ts'];

if (newE2E) {
  preludes.push('./src/__tests__/e2e/prelude.ts');
}

export default {
  timeout: '1m',
  extensions: {
    ts: 'module',
  },
  nodeArguments: ['--import', './swc-esm-register.mjs'],
  workerThreads: false,
  // ^ swc-esm-register loads an SWC-based loader that emits decorator
  //   metadata (which the previous tsx/esm/esbuild loader did not),
  //   required for NestJS @nestjs/graphql @Field() resolution.
  watchMode: {
    ignoreChanges: ['**/*.gen.*'],
  },
  files: newE2E
    ? [newE2ETests]
    : ['**/*.spec.ts', '**/*.e2e.ts', '!' + newE2ETests],
  require: preludes,
  environmentVariables: {
    NODE_ENV: 'test',
    DEPLOYMENT_TYPE: 'affine',
    MAILER_HOST: '0.0.0.0',
    MAILER_PORT: '1025',
    MAILER_USER: 'noreply@toeverything.info',
    MAILER_PASSWORD: 'affine',
    MAILER_SENDER: 'noreply@toeverything.info',
  },
};
