import { describe, expect, test } from 'vitest';

import { resolveSidebarTabClick } from './tab-strip-behavior';

describe('sidebar tab strip behavior', () => {
  test('sidebar search tab > given another tab is active > then opens global search without changing sidebar body', () => {
    expect(resolveSidebarTabClick('inbox', 'search')).toEqual({
      nextActiveTab: 'inbox',
      openQuickSearch: true,
    });
  });

  test('sidebar regular tab > given another tab is active > then swaps sidebar body', () => {
    expect(resolveSidebarTabClick('home', 'chat')).toEqual({
      nextActiveTab: 'chat',
      openQuickSearch: false,
    });
  });
});
