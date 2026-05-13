#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const modes = new Set(['build', 'release', 'deploy']);

const usage = `Usage: node scripts/manut-release-handover.mjs [options]

Generate a Manut control-plane handover in Markdown and optional JSON.

Options:
  --mode <build|release|deploy>      Workflow surface. Default: build
  --status <text>                    Current status. Default depends on mode
  --version <text>                   Release version, if any
  --image-tag <tag>                  GAR image tag
  --image-digest <digest>            Docker image digest
  --gar-repo <repo>                  GAR repository path
  --short-sha <sha>                  Short commit SHA
  --head-sha <sha>                   Full commit SHA
  --ref <ref>                        Git ref name
  --actor <name>                     Triggering actor
  --run-id <id>                      GitHub Actions run id
  --run-url <url>                    GitHub Actions run URL
  --deploy-url <url>                 Production URL
  --output <path>                    Write Markdown to path. Use - for stdout
  --json-output <path>               Write machine-readable JSON to path
  --generated-at <iso>               Override generated timestamp
  --help, -h                         Show this help

Values also fall back to GitHub Actions env vars where available.`;

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(usage);
  process.exit(0);
}

const mode = field('mode', 'MANUT_HANDOVER_MODE', 'build');

if (!modes.has(mode)) {
  fail(`--mode must be one of ${Array.from(modes).join(', ')}`);
}

const repository = env('GITHUB_REPOSITORY', 'mygogocash/Manut');
const generatedAt = field(
  'generated-at',
  'MANUT_HANDOVER_GENERATED_AT',
  new Date().toISOString()
);
const runId = field('run-id', 'GITHUB_RUN_ID', '');
const runUrl = field(
  'run-url',
  'GITHUB_RUN_URL',
  runId && env('GITHUB_SERVER_URL') && repository
    ? `${env('GITHUB_SERVER_URL')}/${repository}/actions/runs/${runId}`
    : ''
);
const headSha = field('head-sha', 'GITHUB_SHA', '');
const shortSha = field(
  'short-sha',
  'MANUT_SHORT_SHA',
  headSha ? headSha.slice(0, 10) : ''
);
const ref = field('ref', 'GITHUB_REF_NAME', env('GITHUB_REF', ''));
const version = field(
  'version',
  'MANUT_VERSION',
  ref.startsWith('v') ? ref : ''
);
const imageTag = field('image-tag', 'IMAGE_TAG', '');
const imageDigest = field('image-digest', 'IMAGE_DIGEST', '');
const garRepo = field(
  'gar-repo',
  'GAR_REPO',
  'asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash'
);
const actor = field('actor', 'GITHUB_ACTOR', '');
const deployUrl = field(
  'deploy-url',
  'MANUT_DEPLOY_URL',
  'https://manut.gogocash.co'
);
const status = field('status', 'MANUT_HANDOVER_STATUS', defaultStatus(mode));

const handover = {
  schemaVersion: 1,
  generatedAt,
  controlPlane: {
    name: 'Manut Control Plane',
    source: 'docs/SUPERFLOW_CONTROL_PLANE.md',
    company: 'GoGoCash Manut',
    goal: 'Ship verified AI-assisted AFFiNE work with durable handover evidence.',
  },
  workflow: {
    mode,
    status,
    repository,
    ref,
    actor,
    runId,
    runUrl,
  },
  release: {
    version,
    shortSha,
    headSha,
    imageTag,
    imageDigest,
    image: imageTag ? `${garRepo}:${imageTag}` : '',
    registry: garRepo,
    deployUrl,
  },
  agents: [
    {
      role: 'Release Captain',
      adapter: 'GitHub Actions summary and docs/RELEASES',
      responsibility:
        'Keep release facts, goal, and pending follow-up visible.',
    },
    {
      role: 'Builder',
      adapter: 'manut-build.yml or manut-release.yml',
      responsibility: 'Create a fresh linux/amd64 image from rebuilt bundles.',
    },
    {
      role: 'Verifier',
      adapter: 'CI checks, bundle logs, prompt guards, and deploy smoke probes',
      responsibility: 'Attach evidence before code is considered safe to ship.',
    },
    {
      role: 'Deployer',
      adapter: 'manut-autodeploy.yml, manut-deploy.yml, deploy.sh',
      responsibility:
        'Run sidecar validation before production swap and preserve rollback.',
    },
    {
      role: 'Historian',
      adapter: 'docs/HANDOVER.md, docs/CICD.md, release notes',
      responsibility:
        'Convert transient build context into durable project memory.',
    },
  ],
  taskTree: [
    'Build fresh server, web, admin, and mobile artifacts.',
    'Package an immutable image tag for the GCE linux/amd64 runtime.',
    'Validate handoff facts and upload machine-readable release context.',
    'Deploy through smoke-then-swap when this image is selected for production.',
    'Record any follow-up risks in handover docs or release notes.',
  ],
  verificationGates: [
    'oxlint and codegen drift guards pass in Manut CI.',
    'server, web, admin, and mobile bundles are rebuilt before docker build.',
    'image tag is immutable and does not rely on latest.',
    'sidecar /info passes before production swap.',
    'post-swap /info and prompt-seed checks pass after deploy.',
  ],
  rollback: {
    workflow: 'manut-rollback.yml',
    vmSnapshot: '/srv/affine/compose/compose.yml.previous.bak',
  },
};

const markdown = renderMarkdown(handover);
const output = field('output', '', '-');
const jsonOutput = field('json-output', '', '');

if (output === '-') {
  process.stdout.write(markdown);
} else if (output) {
  writeFile(output, markdown);
}

if (jsonOutput) {
  writeFile(jsonOutput, `${JSON.stringify(handover, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith('--') && arg !== '-h') {
      fail(`Unexpected argument: ${arg}`);
    }

    if (arg === '-h') {
      parsed.h = true;
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey.trim();

    if (!key) {
      fail(`Invalid option: ${arg}`);
    }

    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      parsed[key] = next;
      i += 1;
    } else {
      parsed[key] = true;
    }
  }

  return parsed;
}

function field(argName, envName, fallback) {
  const argValue = args[argName];

  if (typeof argValue === 'string') {
    return argValue.trim();
  }

  if (envName && process.env[envName]) {
    return process.env[envName].trim();
  }

  return fallback;
}

function env(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

function defaultStatus(workflowMode) {
  if (workflowMode === 'release') {
    return 'release image built';
  }

  if (workflowMode === 'deploy') {
    return 'deploy handover generated';
  }

  return 'build image produced';
}

function renderMarkdown(model) {
  const release = model.release;
  const workflow = model.workflow;

  return `# Manut Release Handover

Generated: ${value(model.generatedAt)}
Status: ${value(workflow.status)}
Mode: ${value(workflow.mode)}
Control plane: ${model.controlPlane.source}

## Company Context

- Company: ${model.controlPlane.company}
- Goal: ${model.controlPlane.goal}
- Repository: ${value(workflow.repository)}
- Production URL: ${value(release.deployUrl)}

## Release Facts

| Field | Value |
| --- | --- |
| Version | ${value(release.version)} |
| Ref | ${value(workflow.ref)} |
| Commit | ${value(release.shortSha)} (${value(release.headSha)}) |
| Image tag | ${value(release.imageTag)} |
| Image digest | ${value(release.imageDigest)} |
| Image | ${value(release.image)} |
| Actor | ${value(workflow.actor)} |
| Run id | ${value(workflow.runId)} |
| Run URL | ${linkOrValue(workflow.runUrl)} |

## Agent Board

| Role | Adapter | Responsibility |
| --- | --- | --- |
${model.agents
  .map(
    agent => `| ${agent.role} | ${agent.adapter} | ${agent.responsibility} |`
  )
  .join('\n')}

## Task Tree

${model.taskTree.map((task, index) => `${index + 1}. ${task}`).join('\n')}

## Verification Gates

${model.verificationGates.map(gate => `- ${gate}`).join('\n')}

## Rollback

- Workflow: ${model.rollback.workflow}
- VM snapshot: ${model.rollback.vmSnapshot}

## Next Handover Step

If this image ships, update docs/HANDOVER.md and add or amend a release note
under docs/RELEASES with the deployed image tag, smoke evidence, and any
open follow-up.
`;
}

function value(input) {
  return input ? escapeMarkdownTable(String(input)) : 'unknown';
}

function linkOrValue(input) {
  if (!input) {
    return 'unknown';
  }

  return `[${escapeMarkdownTable(input)}](${input})`;
}

function escapeMarkdownTable(input) {
  return input.replace(/\|/g, '\\|');
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`Wrote ${filePath}`);
}

function fail(message) {
  console.error(`manut-release-handover: ${message}`);
  console.error('');
  console.error(usage);
  process.exit(1);
}
