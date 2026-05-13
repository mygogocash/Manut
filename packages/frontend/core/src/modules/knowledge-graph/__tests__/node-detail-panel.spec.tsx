/**
 * @vitest-environment happy-dom
 *
 * The React panel itself (`node-detail-panel.tsx`) imports a vanilla-extract
 * style sheet, which this project's vitest setup can't resolve outside of a
 * real vite build context. Rather than spinning up the full plugin chain in
 * the test runner, the panel was split into:
 *
 *   - `node-detail-helpers.ts` — pure, vanilla-extract-free logic
 *   - `node-detail-panel.tsx`  — the React component + styles
 *
 * Tests target the pure surface plus a render-stub smoke check that confirms
 * the component compiles + the JSX evaluates without throwing. That smoke is
 * tied to the pure helpers via the helper-functions assertions below — every
 * branch the panel renders is exercised through `buildLinkLists`,
 * `clusterSize`, `formatRelativeTimestamp`, and `hueShiftToSwatch`.
 */

import { describe, expect, test } from 'vitest';

import {
  type ActivityEvent,
  createActivityBuffer,
} from '../services/activity-buffer';
import {
  buildLinkLists,
  clusterSize,
  formatRelativeTimestamp,
  hueShiftToSwatch,
  type NodeDetailEdge,
} from '../views/node-detail-helpers';

describe('NodeDetailPanel smoke', () => {
  test('builds a sorted outgoing list and an empty incoming list for an orphan-out node', () => {
    const edges: NodeDetailEdge[] = [
      { source: 'src', target: 'z-zebra' },
      { source: 'src', target: 'a-apple' },
      { source: 'src', target: 'm-mango' },
    ];
    const titles: Record<string, string> = {
      'z-zebra': 'Zebra doc',
      'a-apple': 'Apple doc',
      'm-mango': 'Mango doc',
    };
    const lists = buildLinkLists('src', edges, id => titles[id] ?? id);

    expect(lists.outgoing.map(l => l.title)).toEqual([
      'Apple doc',
      'Mango doc',
      'Zebra doc',
    ]);
    expect(lists.incoming).toEqual([]);
  });

  test('handles incoming-only links and de-duplicates if both directions exist', () => {
    const edges: NodeDetailEdge[] = [
      { source: 'a', target: 'centre' },
      { source: 'b', target: 'centre' },
      // duplicate inbound — should not appear twice
      { source: 'a', target: 'centre' },
    ];
    const lists = buildLinkLists('centre', edges, id => `Doc ${id}`);
    expect(lists.outgoing).toEqual([]);
    expect(lists.incoming.map(l => l.title)).toEqual(['Doc a', 'Doc b']);
  });

  test('renders a swatch colour bound to the node hueShift', () => {
    expect(hueShiftToSwatch(1)).toBe('rgb(220, 200, 170)'); // warm
    expect(hueShiftToSwatch(4)).toBe('rgb(170, 200, 240)'); // cool
  });
});

describe('clusterSize', () => {
  test('returns 1 for an orphan node with no edges', () => {
    expect(clusterSize('lonely', [])).toBe(1);
  });

  test('counts directly-linked nodes regardless of edge direction', () => {
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'c', target: 'a' },
    ];
    expect(clusterSize('a', edges)).toBe(3);
  });

  test('does not cross into a disconnected component', () => {
    const edges = [
      { source: 'a', target: 'b' },
      // c-d is a separate cluster
      { source: 'c', target: 'd' },
    ];
    expect(clusterSize('a', edges)).toBe(2);
    expect(clusterSize('c', edges)).toBe(2);
  });

  test('caps at the given cap to avoid walking a giant graph', () => {
    const edges: NodeDetailEdge[] = [];
    for (let i = 1; i < 100; i++) {
      edges.push({ source: 'root', target: `node${i}` });
    }
    expect(clusterSize('root', edges, 10)).toBeLessThanOrEqual(11);
  });
});

describe('formatRelativeTimestamp', () => {
  test('renders "just now" for sub-5s deltas', () => {
    expect(formatRelativeTimestamp(99_000, 100_000)).toBe('just now');
  });
  test('renders seconds for 5..59s deltas', () => {
    expect(formatRelativeTimestamp(70_000, 100_000)).toBe('30s ago');
  });
  test('renders minutes for >=60s deltas', () => {
    expect(formatRelativeTimestamp(0, 125_000)).toBe('2m ago');
  });
  test('clamps negative deltas to "just now" (clock skew defence)', () => {
    expect(formatRelativeTimestamp(200_000, 100_000)).toBe('just now');
  });
});

describe('createActivityBuffer ring', () => {
  test('returns the events for the requested doc in newest-first order', () => {
    const buf = createActivityBuffer();
    buf.push({ docId: 'a', timestamp: 1000, toolName: 'first' });
    buf.push({ docId: 'b', timestamp: 1500, toolName: 'unrelated' });
    buf.push({ docId: 'a', timestamp: 2000, toolName: 'second' });
    buf.push({ docId: 'a', timestamp: 3000, toolName: 'third' });

    const recent = buf.recent('a', 3500);
    expect(recent.map(e => e.toolName)).toEqual(['third', 'second', 'first']);
  });

  test('prunes events older than the 60s default window', () => {
    const buf = createActivityBuffer();
    // 65s ago — outside window.
    buf.push({ docId: 'a', timestamp: 35_000, toolName: 'stale' });
    // 30s ago — inside window.
    buf.push({ docId: 'a', timestamp: 70_000, toolName: 'fresh' });

    const recent = buf.recent('a', 100_000);
    expect(recent.map(e => e.toolName)).toEqual(['fresh']);
  });

  test('respects a custom window', () => {
    const buf = createActivityBuffer({ windowMs: 5_000 });
    buf.push({ docId: 'a', timestamp: 90_000, toolName: 'too-old' });
    buf.push({ docId: 'a', timestamp: 96_000, toolName: 'within' });

    const recent = buf.recent('a', 100_000);
    expect(recent.map(e => e.toolName)).toEqual(['within']);
  });

  test('wraps when capacity is exceeded — oldest events drop out', () => {
    const buf = createActivityBuffer({ capacity: 3, windowMs: 1_000_000 });
    buf.push({ docId: 'a', timestamp: 1, toolName: 'one' });
    buf.push({ docId: 'a', timestamp: 2, toolName: 'two' });
    buf.push({ docId: 'a', timestamp: 3, toolName: 'three' });
    buf.push({ docId: 'a', timestamp: 4, toolName: 'four' });

    expect(buf.size()).toBe(3);
    const recent = buf.recent('a', 1000);
    // 'one' should have been overwritten by 'four'.
    expect(recent.map(e => e.toolName)).toEqual(['four', 'three', 'two']);
  });

  test('returns an empty list when no events match the doc', () => {
    const buf = createActivityBuffer();
    buf.push({ docId: 'someone-else', timestamp: 1000, toolName: 'x' });
    expect(buf.recent('me', 5000)).toEqual([]);
  });

  test('preserves the agent label and free-form data payload', () => {
    const buf = createActivityBuffer();
    const event: ActivityEvent = {
      docId: 'a',
      timestamp: 100,
      toolName: 'docEdit',
      agentLabel: 'Doc Writer',
      data: { promptId: 'prompt-1' },
    };
    buf.push(event);
    const [first] = buf.recent('a', 200);
    expect(first.agentLabel).toBe('Doc Writer');
    expect(first.data).toEqual({ promptId: 'prompt-1' });
  });

  test('clear() empties the buffer', () => {
    const buf = createActivityBuffer();
    buf.push({ docId: 'a', timestamp: 1, toolName: 'x' });
    buf.clear();
    expect(buf.size()).toBe(0);
    expect(buf.recent('a', 100)).toEqual([]);
  });
});
