import { describe, expect, test } from 'vitest';

import { toolsConfigForSend } from './tools-config-for-send';

describe('toolsConfigForSend', () => {
  test('given non-image format > returns the config unchanged', () => {
    const config = { editingDocs: false, enabledTools: ['docRead'] };
    expect(toolsConfigForSend(config, 'auto')).toBe(config);
    expect(toolsConfigForSend(config, 'list')).toBe(config);
    expect(toolsConfigForSend(config, 'table')).toBe(config);
    expect(toolsConfigForSend(config, 'code')).toBe(config);
  });

  test('given image format and an existing allowlist > adds imageGen', () => {
    const config = { enabledTools: ['docRead', 'webSearch'] };
    const result = toolsConfigForSend(config, 'image');
    expect(result.enabledTools).toEqual(['docRead', 'webSearch', 'imageGen']);
  });

  test('given image format and no allowlist > grants imageGen explicitly', () => {
    const config = { editingDocs: false };
    const result = toolsConfigForSend(config, 'image');
    expect(result.enabledTools).toEqual(['imageGen']);
  });

  test('given image format and imageGen already present > returns config unchanged', () => {
    const config = { enabledTools: ['imageGen', 'docRead'] };
    expect(toolsConfigForSend(config, 'image')).toBe(config);
  });

  test('given image format > does not mutate the input config', () => {
    const enabledTools = ['docRead'];
    const config = { enabledTools };
    toolsConfigForSend(config, 'image');
    expect(config.enabledTools).toEqual(['docRead']);
    expect(enabledTools).toEqual(['docRead']);
  });
});
