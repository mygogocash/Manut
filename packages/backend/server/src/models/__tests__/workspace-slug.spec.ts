import test from 'ava';

import {
  buildWorkspaceSlugSeed,
  slugifyWorkspaceName,
} from '../workspace-slug';

test('slugifyWorkspaceName should normalize display names', t => {
  t.is(slugifyWorkspaceName('GoGoCash'), 'gogocash');
  t.is(slugifyWorkspaceName('  Demo Workspace  '), 'demo-workspace');
  t.is(slugifyWorkspaceName(''), 'workspace');
});

test('buildWorkspaceSlugSeed should include id suffix', t => {
  const seed = buildWorkspaceSlugSeed(
    'GoGoCash',
    '56c40ff9-9b0b-49ec-ad88-54ed60cd873d'
  );
  t.true(seed.startsWith('gogocash-'));
  t.true(seed.includes('56c40ff9'));
});
