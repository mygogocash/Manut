import { describe, expect, it } from 'vitest';

import { labelPropagation } from '../utils/graph-math';

describe('labelPropagation', () => {
  it('returns a single cluster for an isolated node', () => {
    const labels = labelPropagation(['a'], []);
    expect(labels.size).toBe(1);
    expect(labels.get('a')).toBe(0);
  });

  it('keeps disjoint components in different clusters', () => {
    // Two triangles, no edge between them.
    const labels = labelPropagation(
      ['a', 'b', 'c', 'x', 'y', 'z'],
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
        { source: 'a', target: 'c' },
        { source: 'x', target: 'y' },
        { source: 'y', target: 'z' },
        { source: 'x', target: 'z' },
      ]
    );
    expect(labels.get('a')).toBe(labels.get('b'));
    expect(labels.get('b')).toBe(labels.get('c'));
    expect(labels.get('x')).toBe(labels.get('y'));
    expect(labels.get('y')).toBe(labels.get('z'));
    expect(labels.get('a')).not.toBe(labels.get('x'));
  });

  it('numbers the largest cluster as 0', () => {
    // Five-node clique + one-node isolate. The clique is largest.
    const labels = labelPropagation(
      ['a', 'b', 'c', 'd', 'e', 'lonely'],
      [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
        { source: 'a', target: 'd' },
        { source: 'a', target: 'e' },
        { source: 'b', target: 'c' },
        { source: 'b', target: 'd' },
        { source: 'b', target: 'e' },
        { source: 'c', target: 'd' },
        { source: 'c', target: 'e' },
        { source: 'd', target: 'e' },
      ]
    );
    expect(labels.get('a')).toBe(0);
    expect(labels.get('lonely')).not.toBe(0);
  });

  it('is deterministic across runs', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'd', target: 'e' },
    ];
    const first = labelPropagation(ids, edges);
    const second = labelPropagation(ids, edges);
    for (const id of ids) {
      expect(first.get(id)).toBe(second.get(id));
    }
  });

  it('handles a star — leaves take the hub label', () => {
    const labels = labelPropagation(
      ['hub', 'l1', 'l2', 'l3', 'l4'],
      [
        { source: 'hub', target: 'l1' },
        { source: 'hub', target: 'l2' },
        { source: 'hub', target: 'l3' },
        { source: 'hub', target: 'l4' },
      ]
    );
    // All five nodes should land in the same cluster, since each leaf has
    // exactly one neighbour (the hub), so all leaves converge on the hub's
    // label.
    const labelSet = new Set(labels.values());
    expect(labelSet.size).toBe(1);
  });
});
