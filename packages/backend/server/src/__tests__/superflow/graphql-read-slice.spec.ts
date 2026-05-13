import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const superflowDir = join(process.cwd(), 'src/plugins/superflow');
const dtoFiles = [
  'superflow.dto.ts',
  'superflow-pm.dto.ts',
  'superflow-crm.dto.ts',
  'superflow-reminder.dto.ts',
  'superflow-handover.resolver.ts',
];

function readSource(file: string) {
  return readFileSync(join(superflowDir, file), 'utf8');
}

test('Superflow PM read queries assert Workspace.Read', t => {
  const source = readSource('superflow-pm.resolver.ts');
  t.true(source.includes("assert('Workspace.Read')"));
  t.regex(source, /async mnProjects\(/);
  t.regex(source, /async mnTasks\(/);
});

test('Superflow CRM read queries assert Workspace.Read', t => {
  const source = readSource('superflow-crm.resolver.ts');
  t.true(source.includes("assert('Workspace.Read')"));
  for (const method of [
    'mnCrmAccounts',
    'mnCrmContacts',
    'mnCrmDealStages',
    'mnCrmDeals',
    'mnCrmActivities',
  ]) {
    t.regex(source, new RegExp(`async ${method}\\(`));
  }
});

test('Superflow mutations assert Workspace.Settings.Update for PM and CRM', t => {
  const pm = readSource('superflow-pm.resolver.ts');
  const crm = readSource('superflow-crm.resolver.ts');
  t.true(pm.includes("assert('Workspace.Settings.Update')"));
  t.true(crm.includes("assert('Workspace.Settings.Update')"));
});

test('Superflow mutable user references require workspace membership checks', t => {
  const pm = readSource('superflow-pm.resolver.ts');
  const crm = readSource('superflow-crm.resolver.ts');

  t.true(pm.includes('assertWorkspaceMember'));
  t.true(crm.includes('assertWorkspaceMember'));
  t.true(pm.includes('input.assigneeUserId'));
  t.true(crm.includes('input.ownerUserId'));
});

test('Superflow nullable DTO fields use explicit GraphQL types', t => {
  for (const file of dtoFiles) {
    const source = readSource(file);

    t.false(
      /@Field\(\{\s*nullable:\s*true/.test(source),
      `${file}: nullable @Field decorators must use @Field(() => Type, { nullable: true })`
    );
  }
});
