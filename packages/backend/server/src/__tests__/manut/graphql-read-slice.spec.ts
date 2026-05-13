import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');
const dtoFiles = [
  'manut.dto.ts',
  'manut-pm.dto.ts',
  'manut-crm.dto.ts',
  'manut-reminder.dto.ts',
  'manut-handover.resolver.ts',
];

function readSource(file: string) {
  return readFileSync(join(manutDir, file), 'utf8');
}

test('Manut PM read queries assert Workspace.Read', t => {
  const source = readSource('manut-pm.resolver.ts');
  t.true(source.includes("assert('Workspace.Read')"));
  t.regex(source, /async mnProjects\(/);
  t.regex(source, /async mnTasks\(/);
});

test('Manut CRM read queries assert Workspace.Read', t => {
  const source = readSource('manut-crm.resolver.ts');
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

test('Manut mutations assert Workspace.Settings.Update for PM and CRM', t => {
  const pm = readSource('manut-pm.resolver.ts');
  const crm = readSource('manut-crm.resolver.ts');
  t.true(pm.includes("assert('Workspace.Settings.Update')"));
  t.true(crm.includes("assert('Workspace.Settings.Update')"));
});

test('Manut mutable user references require workspace membership checks', t => {
  const pm = readSource('manut-pm.resolver.ts');
  const crm = readSource('manut-crm.resolver.ts');

  t.true(pm.includes('assertWorkspaceMember'));
  t.true(crm.includes('assertWorkspaceMember'));
  t.true(pm.includes('input.assigneeUserId'));
  t.true(crm.includes('input.ownerUserId'));
});

test('Manut nullable DTO fields use explicit GraphQL types', t => {
  for (const file of dtoFiles) {
    const source = readSource(file);

    t.false(
      /@Field\(\{\s*nullable:\s*true/.test(source),
      `${file}: nullable @Field decorators must use @Field(() => Type, { nullable: true })`
    );
  }
});
