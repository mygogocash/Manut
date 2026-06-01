import { describe, expect, test } from 'vitest';

import {
  type AIToolName,
  DEFAULT_MODE,
  defaultEnabledTools,
  MODE_TOOL_SET,
} from './modes';

// M5: the Mode picker label and the Advanced submenu's default checked
// set must agree for a fresh/empty config. The label derives from the
// tools-config write flags (all default false -> "read-only"), while the
// Advanced default set comes from defaultEnabledTools(DEFAULT_MODE). If
// DEFAULT_MODE is anything other than 'read', a fresh workspace shows
// "Read-only" on the label but pre-checks Edit-mode write tools in the
// Advanced submenu. The single source of agreement is DEFAULT_MODE.

// The canonical write tools that must NOT be pre-checked when the label
// reads "read-only" (i.e. when the write flags are all false).
const WRITE_TOOLS: readonly AIToolName[] = [
  'docEdit',
  'sectionEdit',
  'dataViewFilter',
  'docCreate',
  'docUpdate',
  'docUpdateMeta',
  'docCompose',
  'dataViewAutofillColumn',
  'imageGen',
  'codeRun',
];

describe('modes', () => {
  test('DEFAULT_MODE > given fresh config with no write flags > matches read-only label', () => {
    // A fresh tools-config has editingDocs/composingDocs/editingDataViews
    // all false, which deriveMode() collapses to "read-only". For the
    // Advanced submenu's default set to agree, DEFAULT_MODE must be 'read'.
    expect(DEFAULT_MODE).toBe('read');
  });

  test('defaultEnabledTools > given DEFAULT_MODE > enables no write tools', () => {
    const defaults = new Set<AIToolName>(defaultEnabledTools(DEFAULT_MODE));
    const enabledWriteTools = WRITE_TOOLS.filter(tool => defaults.has(tool));
    expect(enabledWriteTools).toEqual([]);
  });

  test('defaultEnabledTools > given DEFAULT_MODE > equals the read tool set', () => {
    expect(defaultEnabledTools(DEFAULT_MODE)).toEqual([...MODE_TOOL_SET.read]);
  });
});
