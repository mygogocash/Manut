import { readFileSync } from 'node:fs';

const dockerfilePath = '.docker/manut/Dockerfile.railway';
const dockerfile = readFileSync(dockerfilePath, 'utf8');

const appBuilderStart = dockerfile.indexOf(
  'FROM node:22-bookworm AS app-builder'
);
if (appBuilderStart === -1) {
  throw new Error(`${dockerfilePath}: missing app-builder stage`);
}

const yarnInstall = dockerfile.indexOf('yarn install', appBuilderStart);
if (yarnInstall === -1) {
  throw new Error(
    `${dockerfilePath}: app-builder stage does not run yarn install`
  );
}

const beforeInstall = dockerfile.slice(appBuilderStart, yarnInstall);
const requiredEnv = [
  'HUSKY=0',
  'ELECTRON_SKIP_BINARY_DOWNLOAD=1',
  'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1',
  'SENTRYCLI_SKIP_DOWNLOAD=1',
];

const missing = [];
for (const env of requiredEnv) {
  if (beforeInstall.indexOf(env) === -1) {
    missing.push(env);
  }
}

if (missing.length > 0) {
  throw new Error(
    `${dockerfilePath}: app-builder yarn install is missing ${missing.join(', ')}`
  );
}

console.log(`${dockerfilePath}: Railway install skip env is configured`);
