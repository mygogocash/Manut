import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

function readWorkspaceCss(path: string) {
  return readFileSync(
    fileURLToPath(new URL(`../${path}`, import.meta.url)),
    'utf8'
  );
}

describe('Manut mobile layout contracts', () => {
  test('projects styles include narrow viewport fallbacks for dense rows', () => {
    const source = readWorkspaceCss('projects/projects.css.ts');

    expect(source).toContain('@media');
    expect(source).toContain('max-width: 640px');
    expect(source).toContain('export const toolbar');
    expect(source).toContain("flexDirection: 'column'");
    expect(source).toContain('export const taskRow');
    expect(source).toContain('export const fieldHorizontal');
  });

  test('crm styles include narrow viewport fallbacks for tabs, actions, and rows', () => {
    const source = readWorkspaceCss('crm/styles.css.ts');

    expect(source).toContain('@media');
    expect(source).toContain('max-width: 640px');
    expect(source).toContain('export const tabsList');
    expect(source).toContain('export const actionRow');
    expect(source).toContain('export const listRow');
  });

  test('reminder styles include narrow viewport fallbacks for tabs and preset grid', () => {
    const source = readWorkspaceCss('reminders/styles.css.ts');

    expect(source).toContain('@media');
    expect(source).toContain('max-width: 640px');
    expect(source).toContain('export const toolbar');
    expect(source).toContain('export const tabsList');
    expect(source).toContain('export const presetGrid');
  });
});
