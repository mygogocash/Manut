import test from 'ava';
import { firstValueFrom, take } from 'rxjs';
import Sinon from 'sinon';

import { InsightType } from '../../graphql/analytics.dto';
import { AnalyticsInsightEventBus } from '../../insight-event-bus.service';
import { AnomalyDetectorService } from '../anomaly-detector.service';
import { TrendDetectorService } from '../trend-detector.service';

test('AnomalyDetectorService publishes created anomaly insights', async t => {
  const bus = new AnalyticsInsightEventBus();
  const createdAt = new Date('2026-06-01T00:00:00Z');
  const db = {
    socialMetric: {
      findMany: Sinon.stub().resolves([
        { value: 9 },
        { value: 10 },
        { value: 10 },
        { value: 11 },
        { value: 10 },
      ]),
    },
    socialInsight: {
      create: Sinon.stub().resolves({
        id: 'anomaly-1',
        workspaceId: 'ws-1',
        insightType: 'ANOMALY',
        platforms: ['GOGOCASH'],
        title: 'Anomaly: clicks on GOGOCASH',
        body: 'ACTION_REQUIRED: clicks spiked.',
        severity: 'ACTION_REQUIRED',
        modelUsed: 'gemini-2.5-flash',
        costUsd: 0.001,
        createdAt,
        acknowledgedAt: null,
      }),
    },
  };
  const budget = {
    canSpend: Sinon.stub().resolves(true),
    record: Sinon.stub().resolves(),
  };
  const promptService = {
    get: Sinon.stub().resolves({
      model: 'gemini-2.5-flash',
      finish: () => [{ role: 'user', content: 'metric payload' }],
    }),
  };
  const providerFactory = {
    getProviderByModel: Sinon.stub().resolves({
      text: Sinon.stub().resolves('ACTION_REQUIRED: clicks spiked.'),
    }),
  };
  const service = new AnomalyDetectorService(
    db as never,
    budget as never,
    promptService as never,
    providerFactory as never,
    bus
  );

  const nextEvent = firstValueFrom(bus.subscribe('ws-1').pipe(take(1)));
  await service.checkMetric({
    workspaceId: 'ws-1',
    platform: 'GOGOCASH',
    metricKey: 'clicks',
    value: 100,
    occurredAt: new Date('2026-06-01T01:00:00Z'),
  });
  const event = await nextEvent;

  t.is(event.workspaceId, 'ws-1');
  t.is(event.insight.id, 'anomaly-1');
  t.is(event.insight.insightType, InsightType.ANOMALY);
});

test('TrendDetectorService publishes created trend insights', async t => {
  const bus = new AnalyticsInsightEventBus();
  const createdAt = new Date('2026-06-01T00:00:00Z');
  const db = {
    socialMetric: {
      findMany: Sinon.stub()
        .onFirstCall()
        .resolves([
          {
            platform: 'GOGOCASH',
            metricKey: 'clicks',
            value: 150,
          },
        ])
        .onSecondCall()
        .resolves([
          {
            platform: 'GOGOCASH',
            metricKey: 'clicks',
            value: 100,
          },
        ]),
    },
    socialInsight: {
      create: Sinon.stub().resolves({
        id: 'trend-1',
        workspaceId: 'ws-1',
        insightType: 'TREND',
        platforms: ['GOGOCASH'],
        title: 'Hourly trend detected',
        body: 'Clicks are up 50%.',
        severity: 'INFO',
        modelUsed: 'gemini-2.5-flash',
        costUsd: 0.001,
        createdAt,
        acknowledgedAt: null,
      }),
    },
  };
  const budget = {
    canSpend: Sinon.stub().resolves(true),
    record: Sinon.stub().resolves(),
  };
  const promptService = {
    get: Sinon.stub().resolves({
      model: 'gemini-2.5-flash',
      finish: () => [{ role: 'user', content: 'delta payload' }],
    }),
  };
  const providerFactory = {
    getProviderByModel: Sinon.stub().resolves({
      text: Sinon.stub().resolves('Clicks are up 50%.'),
    }),
  };
  const service = new TrendDetectorService(
    db as never,
    budget as never,
    promptService as never,
    providerFactory as never,
    bus
  );

  const nextEvent = firstValueFrom(bus.subscribe('ws-1').pipe(take(1)));
  await service.detectForWorkspace('ws-1');
  const event = await nextEvent;

  t.is(event.workspaceId, 'ws-1');
  t.is(event.insight.id, 'trend-1');
  t.is(event.insight.insightType, InsightType.TREND);
});
