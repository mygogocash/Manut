import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

function readCoreSource(path: string) {
  return readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), {
    encoding: 'utf8',
  });
}

describe('Manut UX bughunt regression contracts', () => {
  test('responsive sidebar applies small-screen state on the first observed width', () => {
    const source = readCoreSource(
      'components/hooks/use-responsive-siedebar.ts'
    );

    const firstWidthBranch = source.slice(
      source.indexOf('if (previousWidth === null)'),
      source.indexOf('// should hide sidebar')
    );

    expect(firstWidthBranch).toContain('handleHideSidebar()');
    expect(firstWidthBranch).toContain(
      'handleFloatSidebar(width <= floatThreshold)'
    );
  });

  test('mobile Ask AI opens without auto-focusing the chat input', () => {
    const source = readCoreSource('mobile/pages/workspace/home.tsx');

    expect(source).not.toContain('[data-testid="chat-panel-input"]');
    expect(source).toContain(
      'sheetRef.current?.focus({ preventScroll: true })'
    );
  });

  test('mobile focus styles preserve keyboard-visible outlines', () => {
    const source = readCoreSource('mobile/styles/mobile.css.ts');

    expect(source).toContain('a:focus:not(:focus-visible)');
    expect(source).toContain('button:focus:not(:focus-visible)');
    expect(source).toContain('a:focus-visible, button:focus-visible');
  });

  test('mobile app tabs keep list semantics and real tab controls', () => {
    const indexSource = readCoreSource('mobile/components/app-tabs/index.tsx');
    const tabItemSource = readCoreSource(
      'mobile/components/app-tabs/tab-item.tsx'
    );
    const stylesSource = readCoreSource(
      'mobile/components/app-tabs/styles.css.ts'
    );

    expect(indexSource).toContain(
      '<li className={styles.tabItemWrapper} role="presentation">'
    );
    expect(indexSource).toContain('role="tab"');
    expect(indexSource).toContain('aria-selected={isActive}');
    expect(tabItemSource).toContain('<button');
    expect(tabItemSource).toContain('role="tab"');
    expect(tabItemSource).toContain('aria-selected={isActive}');
    expect(stylesSource).toContain('minHeight: 44');
  });

  test('floating AI tabs use sibling select and close buttons', () => {
    const source = readCoreSource(
      'components/floating-ai-chat-anchor/chat-tabs.tsx'
    );
    const styles = readCoreSource(
      'components/floating-ai-chat-anchor/chat-tabs.css.ts'
    );

    expect(source).toContain('className={styles.tabSelectButton}');
    expect(source).toContain('className={styles.tabCloseButton}');
    expect(source).not.toMatch(/<button[\s\S]*className=\{styles\.tab\}/);
    expect(styles).toContain('width: 28');
    expect(styles).toContain('width: 44');
  });

  test('floating AI fullscreen/mobile panel exposes modal semantics and safe-area padding', () => {
    const source = readCoreSource(
      'components/floating-ai-chat-anchor/index.tsx'
    );
    const styles = readCoreSource(
      'components/floating-ai-chat-anchor/styles.css.ts'
    );

    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("document.body.style.overflow = 'hidden'");
    expect(styles).toContain('env(safe-area-inset-top)');
    expect(styles).toContain('env(safe-area-inset-bottom)');
  });

  test('settings hide unwired operational tabs while direct routes show honest copy', () => {
    const source = readCoreSource(
      'desktop/dialogs/setting/workspace-setting/index.tsx'
    );

    expect(source).not.toContain("testId: 'workspace-setting:budget'");
    expect(source).not.toContain("testId: 'workspace-setting:work-queues'");
    expect(source).not.toContain('<BudgetDashboard');
    expect(source).not.toContain('<WorkQueuesPanel');
    expect(source).toContain('This panel is not connected yet.');
  });

  test('AI source cards render expansion and click actions as accessible controls', () => {
    const source = readCoreSource(
      'blocksuite/ai/components/ai-tools/tool-result-card.ts'
    );

    expect(source).toContain('class="ai-tool-header"');
    expect(source).toContain('aria-expanded=${String(!this.isCollapsed)}');
    expect(source).toContain('href=${result.href}');
    expect(source).toContain('class="result-item"');
    expect(source).toContain('@click=${result.onClick}');
  });

  test('analytics connection errors are normalized before display', () => {
    const source = readCoreSource(
      'modules/analytics/views/connections-settings/index.tsx'
    );

    expect(source).toContain('function normalizeConnectionError');
    expect(source).toContain('Connection expired. Reconnect the account.');
    expect(source).toContain('Provider rate limit reached. Try again later.');
    expect(source).toContain('title={connection.lastError}');
  });
});
