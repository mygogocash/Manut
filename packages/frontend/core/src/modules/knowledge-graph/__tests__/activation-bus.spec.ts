import { describe, expect, it } from 'vitest';

import {
  ActivationBus,
  type DocReadActivation,
} from '../services/activation-bus';

function evt(overrides: Partial<DocReadActivation> = {}): DocReadActivation {
  return {
    docId: 'doc-1',
    workspaceId: 'ws-1',
    sourceId: 'src-1',
    op: 'docRead',
    ts: 1_000_000,
    ...overrides,
  };
}

describe('ActivationBus', () => {
  it('forwards a single event to subscribers', () => {
    const bus = new ActivationBus();
    const received: DocReadActivation[] = [];
    bus.asObservable().subscribe(e => received.push(e));
    bus.emit(evt());
    expect(received).toHaveLength(1);
    expect(received[0].docId).toBe('doc-1');
  });

  it('dedupes events with the same sourceId inside the window', () => {
    const bus = new ActivationBus();
    const received: DocReadActivation[] = [];
    bus.asObservable().subscribe(e => received.push(e));
    bus.emit(evt({ ts: 1_000_000, sourceId: 'shared' }));
    // Same sourceId, only 500ms later — should be dropped.
    bus.emit(evt({ ts: 1_000_500, sourceId: 'shared', op: 'searchWorkspace' }));
    expect(received).toHaveLength(1);
    expect(received[0].op).toBe('docRead');
  });

  it('does not dedupe after the window expires', () => {
    const bus = new ActivationBus();
    const received: DocReadActivation[] = [];
    bus.asObservable().subscribe(e => received.push(e));
    bus.emit(evt({ ts: 1_000_000, sourceId: 'shared' }));
    // Far past the 2s window — should forward again.
    bus.emit(evt({ ts: 1_005_000, sourceId: 'shared' }));
    expect(received).toHaveLength(2);
  });

  it('treats different sourceIds as independent events', () => {
    const bus = new ActivationBus();
    const received: DocReadActivation[] = [];
    bus.asObservable().subscribe(e => received.push(e));
    bus.emit(evt({ sourceId: 'a' }));
    bus.emit(evt({ sourceId: 'b' }));
    bus.emit(evt({ sourceId: 'c' }));
    expect(received).toHaveLength(3);
  });
});
