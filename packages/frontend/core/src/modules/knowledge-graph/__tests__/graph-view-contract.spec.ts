import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const graphViewSource = () =>
  readFileSync(
    fileURLToPath(new URL('../views/graph-view.tsx', import.meta.url)),
    'utf8'
  );

describe('knowledge graph view contracts', () => {
  it('keeps the canvas accessible through labels and a keyboard mirror list', () => {
    const source = graphViewSource();

    expect(source).toContain('role="img"');
    expect(source).toContain('aria-label={graphSummary}');
    expect(source).toContain('tabIndex={0}');
    expect(source).toContain('knowledge-graph-a11y-summary');
    expect(source).toContain('knowledge-graph-a11y-list');
    expect(source).toContain('knowledge-graph-a11y-item');
  });

  it('keeps reduced-motion and idle/hidden-tab gates in the render loop', () => {
    const source = graphViewSource();

    expect(source).toContain('prefersReducedMotion()');
    expect(source).toContain('(prefers-reduced-motion: reduce)');
    expect(source).toContain('document.hidden');
    expect(source).toContain('visibilitychange');
    expect(source).toContain('MAX_PHYSICS_NODES');
    expect(source).toContain('isAtRest(');
  });
});
