import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { EventSourceService } from '../../cloud';
import { subscribeInsightStream } from '../services/insight-stream';

class MockEventSource {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, EventListener[]>();
  close = vi.fn();

  addEventListener(type: string, listener: EventListener): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  dispatch(type: string, data: unknown): void {
    const event = { data: JSON.stringify(data) } as MessageEvent<string>;
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
    if (type === 'message') {
      this.onmessage?.(event);
    }
  }

  dispatchRaw(type: string, data: string): void {
    const event = { data } as MessageEvent<string>;
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
    if (type === 'message') {
      this.onmessage?.(event);
    }
  }
}

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeEventSourceService(source: MockEventSource): EventSourceService {
  return {
    eventSource: vi.fn(() => source),
  } as unknown as EventSourceService;
}

const insightEvent = {
  workspaceId: 'ws-1',
  ts: 1780310000000,
  insight: {
    id: 'insight-1',
    insightType: 'TREND',
    platforms: ['GOGOCASH'],
    title: 'Hourly trend detected',
    body: 'CTR is up.',
    severity: 'INFO',
    modelUsed: 'gemini-2.5-flash',
    costUsd: 0.001,
    createdAt: '2026-06-01T00:00:00.000Z',
    acknowledgedAt: null,
  },
};

describe('subscribeInsightStream', () => {
  test('opens the analytics insight stream through EventSourceService', () => {
    const source = new MockEventSource();
    const eventSourceService = makeEventSourceService(source);

    const dispose = subscribeInsightStream(eventSourceService, 'ws-1', vi.fn());

    expect(eventSourceService.eventSource).toHaveBeenCalledWith(
      '/api/workspace/ws-1/analytics/insights-stream',
      { withCredentials: true }
    );

    dispose();
    expect(source.close).toHaveBeenCalled();
  });

  test('maps typed insight events to entity insights for the target workspace', () => {
    const source = new MockEventSource();
    const callback = vi.fn();

    subscribeInsightStream(makeEventSourceService(source), 'ws-1', callback);

    source.dispatch('insight', insightEvent);

    expect(callback).toHaveBeenCalledWith({
      id: 'insight-1',
      workspaceId: 'ws-1',
      insightType: 'TREND',
      severity: 'INFO',
      title: 'Hourly trend detected',
      body: 'CTR is up.',
      platforms: ['GOGOCASH'],
      modelUsed: 'gemini-2.5-flash',
      createdAt: '2026-06-01T00:00:00.000Z',
      acknowledgedAt: null,
    });
  });

  test('drops malformed events and events for another workspace', () => {
    const source = new MockEventSource();
    const callback = vi.fn();

    subscribeInsightStream(makeEventSourceService(source), 'ws-1', callback);

    source.dispatch('insight', { ...insightEvent, workspaceId: 'ws-2' });
    source.dispatchRaw('insight', '{"type":"text-delta"');
    source.dispatch('insight', { workspaceId: 'ws-1', insight: {} });

    expect(callback).not.toHaveBeenCalled();
  });
});
