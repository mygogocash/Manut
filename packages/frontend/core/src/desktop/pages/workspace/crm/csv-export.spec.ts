import { describe, expect, test } from 'vitest';

import type {
  MnCrmAccount,
  MnCrmDeal,
  MnCrmDealStage,
} from '../../../../modules/manut-crm';
import { buildCrmAccountsCsv, buildCrmDealsCsv, toCsv } from './csv-export';

const baseAccount: MnCrmAccount = {
  id: 'account-1',
  workspaceId: 'workspace-1',
  name: 'Acme, Inc.',
  website: 'https://acme.test',
  industry: 'SaaS',
  notes: 'First line\nSecond "quoted" line',
  ownerUserId: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('CRM CSV export helpers', () => {
  test('toCsv escapes comma, quote, and newline cells', () => {
    const csv = toCsv(
      [
        { header: 'Name', value: row => row.name },
        { header: 'Notes', value: row => row.notes },
      ],
      [{ name: 'Acme, Inc.', notes: 'Line 1\nLine "2"' }]
    );

    expect(csv).toBe('Name,Notes\r\n"Acme, Inc.","Line 1\nLine ""2"""\r\n');
  });

  test('toCsv neutralizes spreadsheet formula cells', () => {
    const csv = toCsv(
      [{ header: 'Website', value: row => row.website }],
      [{ website: '=IMPORTXML("https://example.test")' }]
    );

    expect(csv).toBe('Website\r\n"\'=IMPORTXML(""https://example.test"")"\r\n');
  });

  test('buildCrmAccountsCsv emits stable account columns', () => {
    expect(buildCrmAccountsCsv([baseAccount])).toBe(
      [
        'Name,Website,Industry,Notes,Created At,Updated At',
        '"Acme, Inc.",https://acme.test,SaaS,"First line\nSecond ""quoted"" line",2026-06-01T00:00:00.000Z,2026-06-01T00:00:00.000Z',
        '',
      ].join('\r\n')
    );
  });

  test('buildCrmDealsCsv resolves account and stage names', () => {
    const stage: MnCrmDealStage = {
      id: 'stage-1',
      workspaceId: 'workspace-1',
      pipelineKey: 'default',
      name: 'Discovery',
      sortOrder: 0,
      createdAt: '2026-06-01T00:00:00.000Z',
    };
    const deal: MnCrmDeal = {
      id: 'deal-1',
      workspaceId: 'workspace-1',
      accountId: baseAccount.id,
      contactId: null,
      stageId: stage.id,
      name: 'Enterprise launch',
      value: 120000,
      currency: 'USD',
      probability: 70,
      expectedCloseAt: '2026-07-01T00:00:00.000Z',
      ownerUserId: null,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    };

    expect(
      buildCrmDealsCsv([deal], {
        accounts: new Map([[baseAccount.id, baseAccount]]),
        stages: new Map([[stage.id, stage]]),
      })
    ).toBe(
      [
        'Name,Account,Stage,Value,Currency,Probability,Expected Close At,Created At,Updated At',
        'Enterprise launch,"Acme, Inc.",Discovery,120000,USD,70,2026-07-01T00:00:00.000Z,2026-06-01T00:00:00.000Z,2026-06-02T00:00:00.000Z',
        '',
      ].join('\r\n')
    );
  });
});
